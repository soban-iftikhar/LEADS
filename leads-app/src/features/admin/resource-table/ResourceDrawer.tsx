"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/cx";
import type { ActionResult } from "@/lib/admin/action-result";
import type { Field, Option, ResourceConfig, Row } from "@/lib/admin/resource";
import { parseSortableNumber } from "@/lib/format";

export type SaveAction = (input: Record<string, string>) => Promise<ActionResult<unknown>>;

type Props = {
  config: ResourceConfig;
  row: Row | null;
  options: Record<string, Option[]>;
  onSave: SaveAction;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
  onArchive?: () => void;
  disabled?: string;
  onClose: () => void;
};

const blank = (fields: Field[], options: Record<string, Option[]>) =>
  Object.fromEntries(fields.map((f) => [f.key, f.kind === "select" ? (options[f.key] ?? f.options ?? [])[0]?.value ?? "" : ""]));

/** Add / edit form built from the config's fields. The server validates with the same schema. */
export function ResourceDrawer({ config, row, options, onSave, onSaved, onError, onArchive, disabled, onClose }: Props) {
  const fields = (config.fields ?? []).filter((f) => !(row && f.createOnly));
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...blank(fields, options), ...(row?.values ?? {}) }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const title = row ? `Edit ${config.noun}` : (config.addLabel ?? `Add ${config.noun}`);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pending || disabled) return;
    const missing: Record<string, string> = {};
    for (const f of fields) if (f.required && !values[f.key]?.trim()) missing[f.key] = `${f.label} is needed`;
    setErrors(missing);
    if (Object.keys(missing).length) return;
    // "1,20,000" and "2.5 Cr" are fine in number fields
    const input = Object.fromEntries(
      fields.map((f) => {
        const v = values[f.key]?.trim() ?? "";
        const n = f.kind === "number" && v ? parseSortableNumber(v) : Number.NaN;
        return [f.key, Number.isNaN(n) ? v : String(n)];
      }),
    );
    start(async () => {
      const r = await onSave(row ? { ...input, id: row.id } : input);
      if (r.ok) {
        onSaved(r.message);
        onClose();
        return;
      }
      const fe = r.fieldErrors ?? {};
      setErrors(Object.fromEntries(Object.entries(fe).map(([k, m]) => [k, /required|too small|expected/i.test(m) ? `${fields.find((f) => f.key === k)?.label ?? "This"} is needed` : m])));
      onError(r.error);
    });
  };

  return (
    <Drawer
      title={title}
      onClose={onClose}
      footer={
        <>
          {row && onArchive && config.canArchive && (
            <Button variant="ghost" onClick={onArchive}>
              Archive
            </Button>
          )}
          <span style={{ flex: 1 }} />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="resource-form" loading={pending} disabled={!!disabled} title={disabled}>
            {row ? "Save" : (config.addLabel ?? "Add")}
          </Button>
        </>
      }
    >
      <form id="resource-form" className="dform" noValidate onSubmit={submit}>
        {fields.map((f) => {
          const id = `f-${f.key}`;
          const err = errors[f.key];
          const set = (v: string) => {
            setValues((s) => ({ ...s, [f.key]: v }));
            setErrors((s) => ({ ...s, [f.key]: "" }));
          };
          const common = { id, "aria-invalid": err ? true : undefined, "aria-describedby": err ? `${id}-e` : f.hint ? `${id}-h` : undefined };
          return (
            <div key={f.key} className="fld">
              <label htmlFor={id}>{f.label}</label>
              {f.kind === "textarea" ? (
                <textarea {...common} className={cx("ta", err && "bad")} value={values[f.key] ?? ""} onChange={(e) => set(e.target.value)} rows={5} />
              ) : (
                <div className={cx("inp", err && "bad")}>
                  {f.kind === "select" ? (
                    <select {...common} value={values[f.key] ?? ""} onChange={(e) => set(e.target.value)}>
                      {(options[f.key] ?? f.options ?? []).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      {...common}
                      type={f.kind === "email" ? "email" : f.kind === "tel" ? "tel" : "text"}
                      inputMode={f.kind === "number" ? "decimal" : undefined}
                      value={values[f.key] ?? ""}
                      onChange={(e) => set(e.target.value)}
                    />
                  )}
                </div>
              )}
              {err ? (
                <div className="fmsg" id={`${id}-e`} role="alert">
                  <Icon name="alert" size={14} />
                  {err}
                </div>
              ) : (
                f.hint && (
                  <div className="fhint" id={`${id}-h`}>
                    {f.hint}
                  </div>
                )
              )}
            </div>
          );
        })}
      </form>
    </Drawer>
  );
}
