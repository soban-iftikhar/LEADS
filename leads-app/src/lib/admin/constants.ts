// Admin limits and thresholds that are product rules, in one place. Values an admin can change
// without a deploy live in config.app_settings instead (modules/settings).

/** Rows per page on every admin list. */
export const PAGE_SIZE = 20;

/** Search boxes wait this long after the last key before updating the URL. */
export const SEARCH_DEBOUNCE_MS = 250;

/** Longest search text a list accepts. */
export const SEARCH_MAX = 100;

/** Rows a CSV export reads per database round trip. */
export const EXPORT_BATCH = 500;

/** Largest selection a bulk action takes at once. */
export const BULK_MAX = 200;
