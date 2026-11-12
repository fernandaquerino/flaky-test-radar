import 'dotenv/config';
import { createRequire } from 'node:module';
import { hashPassword } from '../apps/api/src/auth/password';
process.env.ADMIN_PASSWORD_HASH = hashPassword('radar-e2e-only-password');
process.env.SESSION_SECRET = 'radar-e2e-session-secret-at-least-32-characters';
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.WEB_ORIGIN = 'http://localhost:3000';
process.env.RADAR_QUEUE_PREFIX = 'radar-e2e';
const { createApp } = createRequire(__filename)(
  '../apps/api/dist/app.js',
) as typeof import('../apps/api/src/app');
void createApp().then((app) => app.listen(3001, '127.0.0.1'));
