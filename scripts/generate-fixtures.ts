import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
for (const [name, shard] of [
  ['report', ''],
  ['shard-1', '1/2'],
  ['shard-2', '2/2'],
]) {
  const output = resolve(`packages/report-parser/fixtures/${name}.json`);
  const run = spawnSync(
    'pnpm',
    [
      'exec',
      'playwright',
      'test',
      '-c',
      'examples/playwright.config.ts',
      ...(shard ? [`--shard=${shard}`] : []),
    ],
    { env: { ...process.env, FIXTURE_OUTPUT: output }, stdio: 'pipe' },
  );
  if (run.error || (run.status !== 0 && run.status !== 1))
    throw new Error('Fixture generation failed');
  // Scrub machine-specific paths from otherwise genuine reporter output.
  const text = readFileSync(output, 'utf8').replaceAll(
    process.cwd(),
    '/sample/flaky-test-radar',
  );
  writeFileSync(output, text);
}
