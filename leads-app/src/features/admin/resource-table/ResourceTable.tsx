"use client";

import { useOptimistic, useState, useTransition, type ReactNode } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Empty } from "@/components/ui/Empty";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/cx";
import { useToast } from "@/components/ui/Toast";
import type { ActionResult } from "@/lib/admin/action-result";
import { PAGE_SIZE } from "@/lib/admin/constants";
import { listQuery, type ListParams, type ListResult, type Option, type ResourceConfig, type Row } from "@/lib/admin/resource";
import { useOnline } from "@/lib/hooks/useOnline";
import { archiveRecord, restoreRecord } from "./actions";
import { BulkBar } from "./BulkBar";
import { Cell } from "./Cell";
import { Pager } from "./Pager";
import { ResourceDrawer, type SaveAction } from "./ResourceDrawer";
import { SortHeader } from "./SortHeader";
import { Toolbar } from "./Toolbar";
import { useTableParams } from "./useTableParams";
import "./resource-table.css";

export type RowActionFn = (input: { ids: string[] }) => Promise<ActionResult<unknown>>;

type Props = {
  config: ResourceConfig;
  result: ListResult;
  params: ListParams;
  /** KPI boxes between the title and the table (server-rendered). */
  kpis?: ReactNode;
  /** Field choices loaded from the database, keyed by field. */
  options?: Record<string, Option[]>;
  rowAction?: RowActionFn;
  save?: SaveAction;
};

type Confirm = { title: string; text: string; label: string; run: () => void };

const ARCHIVE_TEXT = "It's hidden from lists but kept in the database. You can restore it from the Archived tab.";
const OFFLINE = "You're offline. Changes are paused until you're back.";

/** The list engine: every admin list screen is this component with a config and a query. */
export function ResourceTable({ config, result, params, kpis, options = {}, rowAction, save }: Props) {
  const toast = useToast();
  const online = useOnline();
  const { pending, set, hrefFor } = useTableParams(params);
  const [, startAction] = useTransition();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<{ row: Row | null } | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [gone, hide] = useOptimistic<Set<string>, string[]>(new Set(), (s, ids) => new Set([...s, ...ids]));

  const archivedTab = params.tab === "archived";
  const rows = result.rows.filter((r) => !gone.has(r.id));
  const sortKeys = config.columns.flatMap((c) => (c.sort ? [c.sort] : []));
  const offline = online ? undefined : OFFLINE;
  const writable = !config.readOnly;

  // a new page of rows clears the selection
  const [rowsKey, setRowsKey] = useState(result.rows);
  if (rowsKey !== result.rows) {
    setRowsKey(result.rows);
    setPicked(new Set());
  }

  const report = (r: ActionResult<unknown>, undo?: () => void) => {
    if (!r.ok) toast(r.error);
    else toast(r.message, r.undo && undo ? { undo } : undefined);
  };

  const runArchive = (ids: string[], restoreBack: boolean) =>
    startAction(async () => {
      hide(ids);
      setPicked(new Set());
      if (restoreBack) return report(await restoreRecord({ resource: config.resource, ids }));
      const r = await archiveRecord({ resource: config.resource, ids });
      report(r, () => startAction(async () => report(await restoreRecord({ resource: config.resource, ids }))));
    });

  const askArchive = (ids: string[]) =>
    setConfirm({ title: ids.length === 1 ? `Archive this ${config.noun}?` : `Archive ${ids.length} ${config.noun}s?`, text: ARCHIVE_TEXT, label: "Archive", run: () => runArchive(ids, false) });

  const runRowAction = (ids: string[]) =>
    rowAction &&
    startAction(async () => {
      setPicked(new Set());
      const r = await rowAction({ ids });
      report(r, () => startAction(async () => report(await rowAction({ ids }))));
    });

  const onRowAction = (row: Row) => {
    if (offline) return toast(OFFLINE);
    const c = row.action?.confirm;
    if (c) setConfirm({ ...c, run: () => runRowAction([row.id]) });
    else runRowAction([row.id]);
  };

  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allOn = rows.length > 0 && rows.every((r) => picked.has(r.id));
  const ids = [...picked];
  const bulkAction = config.rowAction?.bulk && rowAction && !archivedTab ? rows.find((r) => picked.has(r.id) && r.action)?.action?.label : undefined;
  const exportHref = `/api/admin/export/${config.resource}${listQuery({ ...params, page: 1 }) ? `?${listQuery({ ...params, page: 1 })}` : ""}`;

  return (
    <>
      <PageHeader
        title={config.title}
        sub={config.sub}
        actions={
          <>
            <Button size="sm" icon="download" href={exportHref} download>
              Export
            </Button>
            {config.addLabel && save && writable && (
              <Button variant="primary" icon="plus" onClick={() => (offline ? toast(OFFLINE) : setDrawer({ row: null }))}>
                {config.addLabel}
              </Button>
            )}
          </>
        }
      />
      {kpis}
      <section className={cx("card rtable", pending && "busy")} aria-busy={pending || undefined}>
        <Toolbar config={config} params={params} counts={result.counts} set={set} />
        {writable && ids.length > 0 && (
          <BulkBar
            count={ids.length}
            actionLabel={bulkAction ? (config.rowAction?.bulkLabel ?? bulkAction) : undefined}
            onAction={() => (offline ? toast(OFFLINE) : runRowAction(ids))}
            archiveLabel={config.canArchive ? (archivedTab ? "Restore" : "Archive") : undefined}
            onArchive={() => (offline ? toast(OFFLINE) : archivedTab ? runArchive(ids, true) : askArchive(ids))}
            onClear={() => setPicked(new Set())}
            disabled={offline}
          />
        )}
        <div className="scroll">
          <table className="t">
            <caption className="sr-only">{config.title}</caption>
            <thead>
              <tr>
                {writable && (
                  <th className="ck">
                    <input className="cbx" type="checkbox" aria-label="Select all on this page" checked={allOn} onChange={() => setPicked(allOn ? new Set() : new Set(rows.map((r) => r.id)))} />
                  </th>
                )}
                <th className="sr">Sr.</th>
                {config.columns.map((c) => (
                  <SortHeader key={c.key} col={c} sort={params.sort} sortKeys={sortKeys} onSort={(sort) => set({ sort, page: 1 })} />
                ))}
                {writable && <th className="r">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id} className={cx(picked.has(row.id) && "pick", row.archived && "arch")}>
                  {writable && (
                    <td className="ck">
                      <input className="cbx" type="checkbox" aria-label={`Select row ${(params.page - 1) * PAGE_SIZE + i + 1}`} checked={picked.has(row.id)} onChange={() => toggle(row.id)} />
                    </td>
                  )}
                  <td className="sr">{(params.page - 1) * PAGE_SIZE + i + 1}</td>
                  {config.columns.map((c) => (
                    <td key={c.key} className={cx(c.right && "r")}>
                      <Cell col={c} v={row.cells[c.key] ?? null} />
                    </td>
                  ))}
                  {writable && (
                    <td>
                      <div className="acts">
                        {row.action && !row.archived && rowAction && (
                          <button className="btn xs" type="button" onClick={() => onRowAction(row)} aria-disabled={!!offline || undefined} title={offline}>
                            {row.action.label}
                          </button>
                        )}
                        {config.canEdit && save && !row.archived && (
                          <button className="ib sm ghost" type="button" aria-label="Edit" title="Edit" onClick={() => (offline ? toast(OFFLINE) : setDrawer({ row }))}>
                            <Icon name="pen" size={16} strokeWidth={1.9} />
                          </button>
                        )}
                        {config.canArchive && !row.archived && (
                          <button className="ib sm ghost" type="button" aria-label="Archive" title="Archive (can be restored)" onClick={() => (offline ? toast(OFFLINE) : askArchive([row.id]))}>
                            <Icon name="archive" size={16} strokeWidth={1.9} />
                          </button>
                        )}
                        {config.canArchive && row.archived && (
                          <button className="btn xs" type="button" onClick={() => (offline ? toast(OFFLINE) : runArchive([row.id], true))}>
                            Restore
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <Empty art="house" title="Nothing here">
            {params.q || params.filter !== "all" ? "Try another filter or clear the search." : (config.emptyHint ?? "New records show up here as they arrive.")}
          </Empty>
        )}
        <Pager page={params.page} total={result.total} hrefFor={(page) => hrefFor({ page })} note={config.canArchive ? "Archived items are kept and can be restored" : undefined} />
      </section>

      {drawer && save && (
        <ResourceDrawer
          config={config}
          row={drawer.row}
          options={options}
          onSave={save}
          onSaved={(m) => toast(m)}
          onError={(m) => toast(m)}
          onArchive={
            drawer.row
              ? () => {
                  const id = drawer.row?.id as string;
                  setDrawer(null);
                  askArchive([id]);
                }
              : undefined
          }
          disabled={offline}
          onClose={() => setDrawer(null)}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          text={confirm.text}
          confirmLabel={confirm.label}
          onConfirm={() => {
            confirm.run();
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
