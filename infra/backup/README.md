# infra/backup

Status: not built yet.

- `backup.sh`: nightly `pg_dump --format=custom` of the whole database, kept 14 days, copied off the host.
- `restore.sh`: restore a dump into an empty database; used in a monthly restore test.
- Redis needs no backup: it holds the task queue, locks and counters only. Losing it delays
  work but loses no business data.

The two phone keys (`PHONE_HASH_PEPPER`, `PHONE_ENC_KEY`) are backed up separately from the
database. A database dump without the key cannot reveal phone numbers; a key without a dump is useless.
