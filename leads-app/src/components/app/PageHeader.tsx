import Link from "next/link";
import type { ReactNode } from "react";

type Props = { title: ReactNode; sub?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } };

/** Page title row: optional back link, h1, sub line, actions on the right. */
export function PageHeader({ title, sub, actions, back }: Props) {
  return (
    <div className="ph">
      <div>
        {back && (
          <Link href={back.href} className="back">
            ← {back.label}
          </Link>
        )}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="ph-a">{actions}</div>}
    </div>
  );
}
