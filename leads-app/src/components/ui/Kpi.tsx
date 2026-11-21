import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./icons";

export type KpiProps = {
  label: string;
  value: ReactNode;
  /** Small chip after the value line: "+12%", "2 blocked". */
  delta?: { text: string; down?: boolean };
  sub?: ReactNode;
  icon?: IconName;
  href?: string;
};

/** One number in a box. With `href` the whole box is a link. */
export function Kpi({ label, value, delta, sub, icon, href }: KpiProps) {
  const body = (
    <>
      {icon && <Icon name={icon} size={22} strokeWidth={1.9} className="ic2" />}
      <span className="l">{label}</span>
      <span className="v num">{value}</span>
      {(delta || sub) && (
        <span className="s">
          {delta && <span className={delta.down ? "dl dn" : "dl"}>{delta.text}</span>}
          {sub}
        </span>
      )}
    </>
  );
  return href ? (
    <Link href={href} className="card kpi">
      {body}
    </Link>
  ) : (
    <section className="card kpi">{body}</section>
  );
}

/** Row of KPI boxes (three on list screens, four on the overview). */
export function KpiRow({ items, four }: { items: KpiProps[]; four?: boolean }) {
  return (
    <div className={four ? "kpis" : "kpis k3"}>
      {items.map((k) => (
        <Kpi key={k.label} {...k} />
      ))}
    </div>
  );
}
