"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Empty, Icon, Segmented, useToast } from "@/components/ui";
import type { IconName } from "@/components/ui/icons";
import { getNotifications, readAllNotifications, readNotification } from "@/lib/api";
import { dayBucket, formatDate, formatStamp } from "@/lib/format";
import type { NotificationItem, NotificationType } from "@/types/api";
import { PageHeader } from "./PageHeader";
import { useBadges } from "./badges";

const ICON: Record<NotificationType, IconName> = {
  LEAD_DELIVERED: "inbox",
  REPORT_DECIDED: "flag",
  LISTING_IN_REVIEW: "check",
  LISTING_APPROVED: "check",
  LISTING_NEEDS_INFO: "alert",
  LISTING_REJECTED: "x",
  ORDER_STARTED: "box",
  ORDER_ENDING: "clock",
  ORDER_ENDED: "box",
  CASHBACK_PAID: "wallet",
};

type Page = { items: NotificationItem[]; nextCursor: string | null; unread: number };

export function NotificationsList({ type, initial, now }: { type: string; initial: Page; now: string }) {
  const router = useRouter();
  const toast = useToast();
  const badges = useBadges();
  const n = new Date(now);
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [unread, setUnread] = useState(initial.unread);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  // infinite scroll by cursor
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor) return;
    const io = new IntersectionObserver(async ([en]) => {
      if (!en.isIntersecting || loading) return;
      setLoading(true);
      try {
        const next = await getNotifications({ type: type === "all" ? undefined : type, cursor });
        setItems((x) => [...x, ...next.items]);
        setCursor(next.nextCursor);
      } finally {
        setLoading(false);
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, type, loading]);

  const markAll = async () => {
    const prev = items;
    setItems((x) => x.map((i) => ({ ...i, readAt: i.readAt ?? now })));
    setUnread(0);
    badges.set({ unread: 0 });
    try {
      await readAllNotifications();
      router.refresh();
    } catch {
      setItems(prev);
      toast("Couldn't mark them as read.");
    }
  };

  const open = async (it: NotificationItem) => {
    if (!it.readAt) {
      setItems((x) => x.map((i) => (i.id === it.id ? { ...i, readAt: now } : i)));
      setUnread((u) => Math.max(0, u - 1));
      badges.bump({ unread: -1 });
      readNotification(it.id).catch(() => {});
    }
    router.push(it.href);
  };

  const groups: { label: string; rows: NotificationItem[] }[] = [];
  for (const it of items) {
    const g = dayBucket(it.createdAt, n);
    const last = groups[groups.length - 1];
    if (last?.label === g) last.rows.push(it);
    else groups.push({ label: g, rows: [it] });
  }

  return (
    <>
      <PageHeader title="Notifications" sub={`${unread} unread`} actions={<Button size="sm" onClick={markAll} disabled={unread === 0}>Mark all as read</Button>} />
      <div>
        <Segmented
          label="Filter notifications"
          value={type}
          items={[
            { value: "all", label: "All", href: "/notifications" },
            { value: "lead", label: "Leads", href: "/notifications?type=lead" },
            { value: "listing", label: "Listings", href: "/notifications?type=listing" },
            { value: "package", label: "Package", href: "/notifications?type=package" },
          ]}
        />
      </div>
      <section className="sec" aria-label="Notifications">
        {items.length === 0 ? (
          <div className="sec-b">
            <Empty>Nothing new.</Empty>
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.label} role="group" aria-label={g.label}>
              <div className="gh">{g.label}</div>
              {g.rows.map((it) => (
                <button key={it.id} type="button" className={`nt ${it.readAt ? "" : "unread"}`} onClick={() => open(it)}>
                  <span className="ni" aria-hidden="true">
                    <Icon name={ICON[it.type]} size={18} />
                  </span>
                  <div style={{ flex: "1 1 0%", textAlign: "left" }}>
                    <div style={{ fontWeight: it.readAt ? 500 : 700, fontSize: 14.5 }}>
                      {it.title}
                      {!it.readAt && <span className="sr-only"> (unread)</span>}
                    </div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {it.body}
                    </div>
                  </div>
                  <span className="muted mono" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                    {g.label === "Earlier" ? formatDate(it.createdAt, n) : formatStamp(it.createdAt, n).split(" ").pop()}
                  </span>
                </button>
              ))}
            </div>
          ))
        )}
        {cursor && (
          <div ref={sentinel} className="sec-b" aria-busy={loading}>
            <span className="skel" style={{ width: "40%", height: 14 }} />
          </div>
        )}
      </section>
    </>
  );
}
