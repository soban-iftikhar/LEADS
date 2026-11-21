const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Database ids are UUIDs; anything else from a URL can't name a row. */
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
