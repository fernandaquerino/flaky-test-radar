import 'dotenv/config';
import { createApp } from './app';
void createApp().then((app) =>
  app.listen(Number(process.env.PORT ?? 3001), '127.0.0.1'),
);
