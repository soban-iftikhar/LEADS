"use client";

import Link from "next/link";
import { useRef, type FormEvent } from "react";
import { LampToggle } from "@/components/brand/LampToggle";
import { Icon } from "@/components/ui/Icon";
import { crumbFor } from "./nav";

// screens without a searchable table send the header search to All listings
const NOT_LISTS = new Set(["/admin", "/admin/market", "/admin/outreach/replies", "/admin/settings", "/admin/settings/health"]);

type Props = { path: string; waiting: number; onMenu: () => void; go: (href: string) => void };

export function AdminHeader({ path, waiting, onMenu, go }: Props) {
  const crumb = crumbFor(path);
  const input = useRef<HTMLInputElement>(null);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = input.current?.value.trim() ?? "";
    const base = NOT_LISTS.has(path) || !crumb.page ? "/admin/listings" : path;
    go(q ? `${base}?q=${encodeURIComponent(q)}` : base);
  };

  return (
    <header className="top">
      <button className="ib mbtn" type="button" aria-label="Open menu" onClick={onMenu}>
        <Icon name="menu" size={18} />
      </button>
      <div className="crumb">
        <small>{crumb.group}</small>
        <b key={crumb.page}>{crumb.page}</b>
      </div>
      <form role="search" className="search" onSubmit={onSearch}>
        <Icon name="search" size={16} />
        <input ref={input} type="search" placeholder="Search customers, listings, phones" aria-label="Search" />
      </form>
      <Link href="/admin" className="ib" aria-label={waiting > 0 ? `Needs you, ${waiting} waiting` : "Needs you, nothing waiting"}>
        <Icon name="bell" size={18} strokeWidth={1.9} />
        {waiting > 0 && <span className="dot" />}
      </Link>
      <LampToggle />
    </header>
  );
}
