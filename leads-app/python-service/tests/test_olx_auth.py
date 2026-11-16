from types import SimpleNamespace

from leads_scraper import olx_auth


class FakeRedis(dict):
    def get(self, k):
        return dict.get(self, k)

    def set(self, k, v):
        self[k] = v


def _post(accept: set[str], calls: list):
    def post(url, data, timeout):
        calls.append(data["refresh_token"])
        if data["refresh_token"] in accept:
            return SimpleNamespace(status_code=200, json=lambda: {
                "access_token": "AT-" + data["refresh_token"], "id_token": "ID", "refresh_token": "next"})
        return SimpleNamespace(status_code=400, json=lambda: {"error": "invalid_grant"})
    return post


def test_renew_uses_env_token_and_stores_the_rotated_one():
    rds, calls = FakeRedis(), []
    out = olx_auth.renew("env", rds=rds, post=_post({"env"}, calls))
    assert out == {"access_token": "AT-env", "id_token": "ID"}
    assert rds[olx_auth.REDIS_KEY] == "next"


def test_renew_prefers_the_stored_chain_and_falls_back_to_env():
    rds, calls = FakeRedis({olx_auth.REDIS_KEY: "stored"}), []
    assert olx_auth.renew("env", rds=rds, post=_post({"stored"}, calls))["access_token"] == "AT-stored"
    rds, calls = FakeRedis({olx_auth.REDIS_KEY: "revoked"}), []
    assert olx_auth.renew("env", rds=rds, post=_post({"env"}, calls))["access_token"] == "AT-env"
    assert calls == ["revoked", "env"]


def test_renew_returns_none_when_every_token_is_refused():
    assert olx_auth.renew("env", rds=FakeRedis(), post=_post(set(), [])) is None
