// Test-time Babel config lives here so the bob build config in babel.config.js
// stays a plain TypeScript strip.
module.exports = {
  preset: 'react-native',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.(js|ts|tsx)$': ['babel-jest', { configFile: false, presets: ['module:@react-native/babel-preset'] }],
  },
  modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/example/'],
};
