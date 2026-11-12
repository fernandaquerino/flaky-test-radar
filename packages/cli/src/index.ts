#!/usr/bin/env node
import { run } from './upload';
void run(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
