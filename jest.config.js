export default {
  preset: '@shelf/jest-mongodb',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  transform: {},
};
