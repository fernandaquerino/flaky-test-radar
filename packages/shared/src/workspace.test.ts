import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
test('requires the supported Node LTS', () => {
  const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as {
    engines: { node: string };
  };
  expect(manifest.engines.node).toBe('>=24 <25');
});
