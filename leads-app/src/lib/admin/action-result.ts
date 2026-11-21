/**
 * What every admin server action returns. The client turns `ok: false` into a toast and puts
 * `fieldErrors` next to the inputs; `undo` tells the toast to offer Undo.
 */
export type ActionResult<T = undefined> =
  | { ok: true; message: string; data?: T; undo?: boolean }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const done = <T = undefined>(message: string, extra: { data?: T; undo?: boolean } = {}): ActionResult<T> => ({ ok: true, message, ...extra });
export const failed = (error: string, fieldErrors?: Record<string, string>): ActionResult<never> => ({ ok: false, error, fieldErrors });
