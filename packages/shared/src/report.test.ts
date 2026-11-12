import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { reportSchema } from './report';
test('validation preserves raw reporter fields, including suite source locations', () => {
  const raw: unknown = JSON.parse(
    readFileSync('packages/report-parser/fixtures/report.json', 'utf8'),
  );
  expect(reportSchema.parse(raw)).toEqual(raw);
});
