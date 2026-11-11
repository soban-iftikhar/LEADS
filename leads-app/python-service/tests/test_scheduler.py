from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from celery.schedules import crontab

import tasks
from celery_app import app
from leads import runs

PKT_2AM_UTC = datetime(2026, 11, 10, 21, 0, 0, tzinfo=timezone.utc)  # 11 Nov 02:00 Asia/Karachi


class Dispatched:
    def __init__(self):
        self.calls = []

    def __call__(self, run_id, portals, window_hours):
        self.calls.append((run_id, portals, window_hours))


# --- beat schedule ---------------------------------------------------------------

def test_beat_entry_is_2am_karachi_with_utc_enabled():
    entry = app.conf.beat_schedule["crawl-daily-refresh"]
    assert entry["task"] == "crawl.daily_refresh"
    assert entry["schedule"].hour == {2} and entry["schedule"].minute == {0}
    assert app.conf.timezone == "Asia/Karachi" and app.conf.enable_utc is True


@pytest.mark.parametrize("now, due", [
    (PKT_2AM_UTC, True),                              # 21:00 UTC = 02:00 PKT next day
    (PKT_2AM_UTC - timedelta(minutes=1), False),      # 01:59 PKT
    (datetime(2026, 11, 10, 2, 0, tzinfo=timezone.utc), False),  # 02:00 UTC is 07:00 PKT
])
def test_beat_fires_daily_refresh_at_0200_pkt(now, due):
    # Beat evaluates the crontab against app.now(), which is in the app timezone.
    local = lambda dt: dt.astimezone(app.timezone)  # noqa: E731 - same instant, Karachi clock
    sched = crontab(hour=2, minute=0, app=app, nowfun=lambda: local(now))
    last_run = PKT_2AM_UTC - timedelta(hours=24) + timedelta(seconds=30)  # just after the previous 02:00 PKT
    if now < last_run:
        last_run -= timedelta(hours=24)
    is_due, _ = sched.is_due(local(last_run))
    assert is_due is due


def test_app_clock_is_karachi_time():
    assert str(app.timezone) == "Asia/Karachi"
    assert app.now().utcoffset() == timedelta(hours=5)


def test_pkt_date_is_the_karachi_calendar_day():
    assert runs.pkt_date(PKT_2AM_UTC).isoformat() == "2026-11-11"
    assert runs.pkt_date(PKT_2AM_UTC - timedelta(hours=3)).isoformat() == "2026-11-10"


def test_visibility_timeout_is_longer_than_the_crawl_time_limit():
    assert app.conf.broker_transport_options["visibility_timeout"] > runs.SPIDER_HARD_LIMIT
    assert app.tasks["crawl.run_portal"].time_limit == runs.SPIDER_HARD_LIMIT
    assert app.tasks["crawl.run_portal"].soft_time_limit == runs.SPIDER_SOFT_LIMIT
    assert app.conf.task_routes["crawl.run_portal"]["queue"] == "crawl"


# --- one run per day ---------------------------------------------------------------

def test_scheduled_run_creates_rows_and_dispatches_every_active_portal(db, rds):
    sent = Dispatched()
    run_id = tasks.start_run("schedule", pool=db, rds=rds, now=PKT_2AM_UTC, dispatch=sent)
    assert run_id and sent.calls == [(run_id, ["graana", "ilaan", "olx", "zameen"], 26)]
    with db.connection() as conn:
        run = conn.execute("SELECT trigger, window_hours, status, lock_key FROM master.crawl_runs").fetchall()
        portals = conn.execute("SELECT platform, status FROM master.crawl_run_portals ORDER BY 1").fetchall()
    assert run == [("schedule", 26, "running", "schedule:2026-11-11")]
    assert portals == [(p, "running") for p in ["graana", "ilaan", "olx", "zameen"]]


def test_second_trigger_on_the_same_date_exits_on_the_lock(db, rds):
    sent = Dispatched()
    first = tasks.start_run("schedule", pool=db, rds=rds, now=PKT_2AM_UTC, dispatch=sent)
    second = tasks.start_run("schedule", pool=db, rds=rds, now=PKT_2AM_UTC + timedelta(minutes=5), dispatch=sent)
    assert first and second is None and len(sent.calls) == 1


def test_database_lock_holds_even_if_redis_is_flushed(db, rds):
    sent = Dispatched()
    tasks.start_run("schedule", pool=db, rds=rds, now=PKT_2AM_UTC, dispatch=sent)
    rds.flushdb()
    assert tasks.start_run("schedule", pool=db, rds=rds, now=PKT_2AM_UTC, dispatch=sent) is None
    with db.connection() as conn:
        assert conn.execute("SELECT count(*) FROM master.crawl_runs").fetchone()[0] == 1


def test_next_day_runs_again_and_manual_runs_are_not_locked(db, rds):
    sent = Dispatched()
    assert tasks.start_run("schedule", pool=db, rds=rds, now=PKT_2AM_UTC, dispatch=sent)
    assert tasks.start_run("schedule", pool=db, rds=rds, now=PKT_2AM_UTC + timedelta(days=1), dispatch=sent)
    assert tasks.start_run("manual", pool=db, rds=rds, now=PKT_2AM_UTC, dispatch=sent)
    assert tasks.start_run("manual", pool=db, rds=rds, now=PKT_2AM_UTC, dispatch=sent)
    assert len(sent.calls) == 4


# --- catch-up ------------------------------------------------------------------------

def _insert_run(db, status, started_at, trigger="schedule"):
    with db.connection() as conn:
        return conn.execute(
            """INSERT INTO master.crawl_runs (trigger, window_hours, status, started_at, finished_at)
               VALUES (%s, 26, %s, %s, %s) RETURNING id""",
            (trigger, status, started_at, None if status == "running" else started_at + timedelta(hours=1)),
        ).fetchone()[0]


def test_catchup_fires_when_the_last_good_run_is_26_hours_old(db):
    now = PKT_2AM_UTC
    assert runs.needs_catchup(db, now) is True                       # never ran
    _insert_run(db, "success", now - timedelta(hours=26))
    assert runs.needs_catchup(db, now) is True
    _insert_run(db, "partial", now - timedelta(hours=24))
    assert runs.needs_catchup(db, now) is False                      # a partial run counts as good


def test_no_catchup_while_a_run_is_in_progress_and_failed_runs_do_not_count(db):
    now = PKT_2AM_UTC
    _insert_run(db, "failed", now - timedelta(hours=2))
    assert runs.needs_catchup(db, now) is True
    _insert_run(db, "running", now - timedelta(minutes=10))
    assert runs.needs_catchup(db, now) is False


def test_stale_running_run_is_closed_as_failed(db):
    now = PKT_2AM_UTC
    run_id = _insert_run(db, "running", now - timedelta(hours=5))
    with db.connection() as conn:
        conn.execute("INSERT INTO master.crawl_run_portals (run_id, platform, status) VALUES (%s, 'olx', 'running')", (run_id,))
    assert runs.fail_stale_runs(db, now) == 1
    with db.connection() as conn:
        assert conn.execute("SELECT status FROM master.crawl_runs").fetchone()[0] == "failed"
        assert conn.execute("SELECT status FROM master.crawl_run_portals").fetchone()[0] == "failed"
    assert runs.needs_catchup(db, now) is True


# --- closing a run -------------------------------------------------------------------

@pytest.mark.parametrize("rows, expected", [
    ([("success", None)] * 4, "success"),
    ([("success", None), ("failed", "blocked")], "partial"),
    ([("success", "token expired: login refused"), ("success", None)], "partial"),
    ([("failed", "x")] * 3, "failed"),
    ([("success", None), ("skipped", None), ("skipped", None)], "success"),
    ([("failed", "blocked"), ("skipped", None)], "failed"),
    ([], "failed"),
])
def test_run_status_from_portal_results(rows, expected):
    assert runs.summarize(rows) == expected


def _finish(db, run_id, platform, status, error=None, seen=0, new=0):
    with db.connection() as conn:
        conn.execute(
            """UPDATE master.crawl_run_portals SET status = %s, error = %s, items_seen = %s, items_new = %s,
                      finished_at = now() WHERE run_id = %s AND platform = %s""",
            (status, error, seen, new, run_id, platform))


def test_finalize_marks_unreported_portals_failed_and_sets_partial(db, rds):
    run_id = tasks.start_run("schedule", pool=db, rds=rds, now=PKT_2AM_UTC, dispatch=Dispatched())
    _finish(db, run_id, "olx", "success", seen=40, new=12)
    _finish(db, run_id, "zameen", "success", seen=10, new=3)
    _finish(db, run_id, "ilaan", "success", "token expired: login refused, listings saved without phone numbers", 5, 5)
    status, stats = runs.finalize_run(db, run_id)                     # graana never reported
    assert status == "partial" and stats["seen"] == 55 and stats["new"] == 20
    assert stats["portals"]["graana"]["status"] == "failed"
    with db.connection() as conn:
        row = conn.execute("SELECT status, finished_at IS NOT NULL, error FROM master.crawl_runs").fetchone()
    assert row[0] == "partial" and row[1] and "token expired" in row[2] and "graana" in row[2]


def test_alert_on_failed_and_on_partial_two_runs_in_a_row(db):
    now = PKT_2AM_UTC
    first = _insert_run(db, "partial", now - timedelta(days=1))
    assert runs.should_alert(db, first, "partial") is False           # first partial: no email
    second = _insert_run(db, "partial", now)
    assert runs.should_alert(db, second, "partial") is True           # two in a row
    assert runs.should_alert(db, second, "failed") is True
    assert runs.should_alert(db, second, "success") is False


def test_portal_left_running_by_a_dead_spider_is_failed_with_a_reason(db, rds):
    run_id = tasks.start_run("manual", pool=db, rds=rds, dispatch=Dispatched())
    assert runs.fail_portal_if_unfinished(db, run_id, "olx", "spider exited with code 1") is True
    assert runs.fail_portal_if_unfinished(db, run_id, "olx", "again") is False   # already closed
    with db.connection() as conn:
        assert conn.execute(
            "SELECT status, error FROM master.crawl_run_portals WHERE platform = 'olx'").fetchone() == ("failed", "spider exited with code 1")


# --- job requests from the web app --------------------------------------------------

def test_manual_crawl_request_is_claimed_once_and_marked_done(db, monkeypatch):
    started = []
    monkeypatch.setattr(tasks, "start_run", lambda trigger: started.append(trigger) or "run-123")
    with db.connection() as conn:
        conn.execute("INSERT INTO ops.job_requests (type, payload) VALUES ('CRAWL_MANUAL', '{}')")
        conn.execute("INSERT INTO ops.job_requests (type, payload, run_after) VALUES ('CRAWL_MANUAL', '{}', now() + interval '1 hour')")
    assert tasks.dispatch_requests() == 1 and started == ["manual"]
    assert tasks.dispatch_requests() == 0                             # nothing left that is due
    with db.connection() as conn:
        rows = conn.execute("SELECT status::text, attempts, payload->>'run_id' FROM ops.job_requests ORDER BY run_after").fetchall()
    assert rows == [("DONE", 1, "run-123"), ("PENDING", 0, None)]


def test_failed_job_request_is_retried_with_backoff_then_failed(db, monkeypatch):
    def boom(trigger):
        raise RuntimeError("redis down")
    monkeypatch.setattr(tasks, "start_run", boom)
    with db.connection() as conn:
        conn.execute("INSERT INTO ops.job_requests (type, payload, max_attempts) VALUES ('CRAWL_MANUAL', '{}', 2)")
    tasks.dispatch_requests()
    with db.connection() as conn:
        assert conn.execute("SELECT status::text, attempts, run_after > now(), error FROM ops.job_requests").fetchone() == ("PENDING", 1, True, "redis down")
        conn.execute("UPDATE ops.job_requests SET run_after = now()")
    tasks.dispatch_requests()
    with db.connection() as conn:
        assert conn.execute("SELECT status::text, attempts FROM ops.job_requests").fetchone() == ("FAILED", 2)


def test_heartbeat_upserts_one_row(db):
    tasks.heartbeat()
    tasks.heartbeat()
    with db.connection() as conn:
        assert conn.execute("SELECT count(*), max(service) FROM ops.heartbeats").fetchone() == (1, "beat")


# --- crawl window in spiders --------------------------------------------------------

def test_spider_window_keeps_new_and_unknown_dates_and_stops_paging_on_an_old_page():
    from leads_scraper.spiders.olx import OLXSpider
    spider = OLXSpider(since_hours="26", full_scrape="true")
    now = spider.started_at
    assert spider.is_fresh((now - timedelta(hours=3)).timestamp()) is True
    assert spider.is_fresh((now - timedelta(hours=30)).timestamp()) is False and spider.skipped_old == 1
    assert spider.is_fresh(None) is True and spider.is_fresh("no idea") is True
    assert spider.keep_paging(fresh_on_page=4, page=1) is True
    assert spider.keep_paging(fresh_on_page=0, page=1) is False
    assert spider.keep_paging(fresh_on_page=4, page=spider.max_pages) is False


def test_spider_without_window_keeps_everything():
    from leads_scraper.spiders.olx import OLXSpider
    spider = OLXSpider()
    assert spider.cutoff is None and spider.is_fresh(1) is True


def test_blocked_portal_and_expired_token_are_reported():
    from leads_scraper.spiders.ilaan import IlaanSpider
    spider = IlaanSpider()
    assert spider.blocked_reason() is None
    spider.auth_failed = True
    assert "token expired" in spider.blocked_reason()
    spider.auth_failed, spider.errors = False, [{"error": "Ignoring non-200 response"}]
    assert "no listing page could be fetched" in spider.blocked_reason()
    # listing pages load but most detail pages are refused (Graana on 11 Nov: 106 errors, 5 saved)
    spider.pages_fetched, spider.records_collected, spider.errors = 12, 5, [{"error": "403"}] * 106
    assert "mostly blocked: 106 requests failed, 5 listings saved" == spider.blocked_reason()
    # a few failures in a healthy run are not a problem
    spider.records_collected, spider.errors = 106, [{"error": "503"}] * 8
    assert spider.blocked_reason() is None


def test_zameen_external_id_from_detail_url():
    from leads_scraper.spiders.zameen import ZameenSpider
    spider = ZameenSpider()
    url = "https://www.zameen.com/Property/mpchs_block_c_house_for_sale-54827763-3118-1.html"
    assert spider._extract_external_id(url) == "54827763"
    assert spider._extract_external_id("https://www.zameen.com/Homes/Islamabad-3-1.html") == ""


def test_search_hit_dates_map_external_id_to_newest_date():
    from leads_scraper.extract import hit_dates
    state = {"algolia": {"content": {"hits": [
        {"externalID": "111", "createdAt": 1794200595},
        {"externalID": 222, "timestamp": 1794100000.5},
        {"title": "no id"},
    ]}}}
    assert hit_dates(state) == {"111": 1794200595, "222": 1794100000.5}
    assert hit_dates({}) == {}


def test_spider_child_killed_when_runner_is_stopped(db, rds, monkeypatch, tmp_path):
    import subprocess, sys
    monkeypatch.setattr(runs, "LOG_DIR", tmp_path)
    monkeypatch.setattr(runs, "spider_command", lambda *a: [sys.executable, "-c", "import time; time.sleep(60)"])
    run_id = tasks.start_run("manual", pool=db, rds=rds, dispatch=Dispatched())
    result = runs.run_portal_process(db, run_id, "olx", 26, timeout=1)      # stands in for a hung spider
    assert result["returncode"] == -1 and "stopped" in result["error"]
    assert not runs._children                                             # nothing left running
    with db.connection() as conn:
        assert conn.execute(
            "SELECT status FROM master.crawl_run_portals WHERE platform = 'olx'").fetchone()[0] == "failed"


def test_celery_can_connect_to_the_redis_broker(rds):
    # Catches an incompatible celery / kombu / redis-py set, which only fails at connect time.
    with app.connection_for_write() as conn:
        conn.ensure_connection(max_retries=1)
        assert conn.connected


def test_spider_time_limit_is_below_the_task_soft_limit():
    from leads_scraper import settings
    assert 3600 < settings.CLOSESPIDER_TIMEOUT < runs.SPIDER_SOFT_LIMIT


def _reveal_response(status, body=b'{"success": true, "data": {"phone": "03001234567"}}', headers=None):
    from scrapy.http import Request, TextResponse
    url = "https://npi.ilaan.com/api/properties-new/1/reveal-contact?channel=call"
    return TextResponse(url, status=status, body=body, headers=headers or {}, request=Request(url), encoding="utf-8")


def test_ilaan_stops_revealing_on_429_and_keeps_the_listing():
    from leads_scraper.spiders.ilaan import IlaanSpider
    spider = IlaanSpider()
    spider.auth_token = "t"
    entry, ctx, search = {"propertyId": 1}, {"category": "house", "purpose": "sale"}, {"type": "House", "status": "ForSale"}

    ok = list(spider.reveal_contact(_reveal_response(200), entry, ctx, search))
    assert ok[0]["payload"]["reveal_contact"]["status"] == 200 and spider.revealed == 1 and not spider.reveal_paused

    limited = list(spider.reveal_contact(
        _reveal_response(429, b'{"error": "Too many requests"}', {"Retry-After": "3600"}), entry, ctx, search))
    assert limited[0]["payload"]["reveal_contact"] is None        # saved, without a phone
    assert spider.reveal_paused and spider.rate_limited == 1
    assert spider.auth_failed is False                            # a rate limit is not a login failure


def test_ilaan_pauses_when_the_last_allowed_reveal_is_used():
    from leads_scraper.spiders.ilaan import IlaanSpider
    spider = IlaanSpider()
    spider.auth_token = "t"
    list(spider.reveal_contact(_reveal_response(200, headers={"X-Rate-Limit-Remaining": "0"}),
                               {"propertyId": 1}, {"category": "house", "purpose": "sale"}, {}))
    assert spider.reveal_paused is True


def test_ilaan_reveals_only_free_numbers():
    from leads_scraper.spiders.ilaan import IlaanSpider
    spider = IlaanSpider()
    spider.auth_token = "t"
    owner = {"agentPhone": "0304-XXXXXXX", "isVerified": False, "isGoldVerified": False}
    assert spider._revealable(owner) is True
    assert spider._revealable({**owner, "isVerified": True}) is False       # paid
    assert spider._revealable({**owner, "isGoldVerified": True}) is False   # paid
    assert spider._revealable({**owner, "agentPhone": ""}) is False         # nothing to reveal
    spider.auth_token = None
    assert spider._revealable(owner) is False
