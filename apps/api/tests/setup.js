/**
 * Jest Setup File
 * Runs before each test suite
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'your_super_secret_access_key_123!@#';
process.env.JWT_REFRESH_SECRET = 'your_super_secret_refresh_key_987!@#';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';

// Mock Redis to avoid connection issues in tests
jest.mock('../src/db/redis.js', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  quit: jest.fn(),
}));

// Silence console.error during tests unless explicitly needed
const originalConsoleError = console.error;
console.error = (...args) => {
  if (
    args[0]?.includes?.('Failed to write access log') ||
    args[0]?.includes?.('Redis cache')
  ) {
    return;
  }
  originalConsoleError.apply(console, args);
};

// Restore console.error after all tests
afterAll(() => {
  console.error = originalConsoleError;
});
