import 'dotenv/config';
import { createRequire } from 'node:module';
process.env.RADAR_QUEUE_PREFIX = 'radar-e2e';
createRequire(__filename)('../apps/worker/dist/main.js');
