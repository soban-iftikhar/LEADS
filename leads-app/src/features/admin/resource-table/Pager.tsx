import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { PAGE_SIZE } from "@/lib/admin/constants";
import { formatNumber } from "@/lib/format";

type Props = { page: number; total: number; hrefFor: (page: number) => string; note?: string };

/** "Showing 21–40 of 312", previous / next, and a reminder that archived rows are kept. */
export function Pager({ page, total, hrefFor, note }: Props) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(total, page * PAGE_SIZE);
  return (
    <div className="foot">
      <span>
        Showing {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}
      </span>
      {note && <span className="foot-note">{note}</span>}
      {pages > 1 && (
        <nav className="pager" aria-label="Pages">
          {page > 1 ? (
            <Link className="ib sm" href={hrefFor(page - 1)} scroll={false} aria-label="Previous page">
              <Icon name="back" size={16} />
            </Link>
          ) : (
            <span className="ib sm off" aria-hidden="true">
              <Icon name="back" size={16} />
            </span>
          )}
          <span className="num">
            {page} / {pages}
          </span>
          {page < pages ? (
            <Link className="ib sm" href={hrefFor(page + 1)} scroll={false} aria-label="Next page">
              <Icon name="chev" size={16} />
            </Link>
          ) : (
            <span className="ib sm off" aria-hidden="true">
              <Icon name="chev" size={16} />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
