// Runs before any module import in each test file.
// NODE_ENV=test must be set before src/index.ts loads so app.listen() is skipped
// and the geo/dev shortcuts behave like production code paths.
// dotenv (loaded by index.ts) never overrides pre-set vars, so these stick.
process.env.NODE_ENV = 'test';
process.env.ENABLE_OTP_BYPASS = 'true'; // verify-otp accepts 000000 outside production
