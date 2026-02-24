import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { strict: true, esModuleInterop: true } }],
  },
  setupFiles: ['<rootDir>/src/__tests__/helpers/env.ts'],
  testTimeout: 30000,
  maxWorkers: 1,
  verbose: true,
};

export default config;
