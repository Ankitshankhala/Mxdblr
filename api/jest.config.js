/** Smoke-test floor — runs against the local dev database defined in .env */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/__tests__'],
  testMatch: ['**/*.smoke.test.ts'],
  setupFiles: ['<rootDir>/src/__tests__/setup-env.ts'],
  testTimeout: 30000,
  // Every suite shares ONE database, and they create/mutate/delete overlapping
  // rows (products by SKU, tagged dealers, cart items). Run in parallel and the
  // workers race each other: identical trees produced 12, 33 and 35 failures on
  // consecutive runs, while serialized runs pass 100/100 repeatably. Until each
  // worker gets its own schema, serial execution is what makes the suite a gate
  // rather than a coin flip.
  maxWorkers: 1,
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
};
