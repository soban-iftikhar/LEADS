// Points every integration test at the test database and Redis db 15, never at dev data.
// Override with TEST_DATABASE_URL / TEST_REDIS_URL (CI sets them to its service containers).
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://leads_user:leads_password@localhost:5432/leads_test";
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://localhost:6379/15";
