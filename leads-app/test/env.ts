// Minimal valid environment for unit tests. Import before anything that calls env().
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.REDIS_URL ??= "redis://localhost:6379/15";
process.env.JWT_SECRET ??= "test-secret-test-secret-test-secret-0123";
process.env.WHATSAPP_APP_SECRET ??= "test-app-secret";
process.env.TRUSTED_PROXY_HOPS ??= "1";
