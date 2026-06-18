/** Smoke-test floor — runs against the local dev database defined in .env */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/__tests__'],
  testMatch: ['**/*.smoke.test.ts'],
  setupFiles: ['<rootDir>/src/__tests__/setup-env.ts'],
  testTimeout: 30000,
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
};
