"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type Badges = { newLeads: number; unread: number; bump: (d: { newLeads?: number; unread?: number }) => void; set: (b: { newLeads?: number; unread?: number }) => void };

const Ctx = createContext<Badges>({ newLeads: 0, unread: 0, bump: () => {}, set: () => {} });

/** Top-bar counters. Pages adjust them optimistically (e.g. marking a lead Contacted). */
export function BadgeProvider({ newLeads, unread, children }: { newLeads: number; unread: number; children: ReactNode }) {
  const [state, setState] = useState({ newLeads, unread, srcLeads: newLeads, srcUnread: unread });
  // fresh server counts (after router.refresh) win over local adjustments
  if (state.srcLeads !== newLeads || state.srcUnread !== unread) {
    setState({ newLeads, unread, srcLeads: newLeads, srcUnread: unread });
  }
  const value = useMemo<Badges>(
    () => ({
      newLeads: state.newLeads,
      unread: state.unread,
      bump: (d) => setState((s) => ({ ...s, newLeads: Math.max(0, s.newLeads + (d.newLeads ?? 0)), unread: Math.max(0, s.unread + (d.unread ?? 0)) })),
      set: (b) => setState((s) => ({ ...s, ...b })),
    }),
    [state.newLeads, state.unread],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBadges() {
  return useContext(Ctx);
}
