import 'dotenv/config';
process.env.RADAR_QUEUE_PREFIX = 'radar-e2e';
void import('../apps/worker/dist/main');
