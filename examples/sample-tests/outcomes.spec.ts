import { expect, test } from '@playwright/test';
test.describe('sample checkout', () => {
  test('passes', () => {
    expect(2 + 2).toBe(4);
  });
  test('flaky on first attempt', ({ browserName }, info) => {
    expect(browserName).toBe('chromium');
    expect(info.retry).toBe(1);
  });
  test('fails every attempt', () => {
    expect('pending').toBe('complete');
  });
  test('skipped', () => {
    test.skip();
  });
  test('expected failure', () => {
    test.fail();
    expect(false).toBe(true);
  });
});
