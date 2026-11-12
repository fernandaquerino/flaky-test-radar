import 'reflect-metadata';
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createApp } from './app';
import { Database } from './database';
import { UploadQueue } from './uploads/queue.service';
import { hashPassword } from './auth/password';
let app: Awaited<ReturnType<typeof createApp>>;
let db: Database;
let cookie: string;
let token: string;
let tokenId: string;
const slug = `integration-${randomUUID()}`;
const report: unknown = JSON.parse(
  readFileSync('packages/report-parser/fixtures/report.json', 'utf8'),
);
const body = {
  ciRunId: 'run-1',
  attempt: 1,
  commitSha: 'abcdef1234567',
  branch: 'main',
  report,
};
beforeAll(async () => {
  process.env.ADMIN_PASSWORD_HASH = hashPassword('integration-password');
  process.env.SESSION_SECRET =
    'integration-session-secret-at-least-32-characters';
  process.env.RADAR_QUEUE_PREFIX = `integration-${randomUUID()}`;
  app = await createApp();
  db = app.get(Database);
});
afterAll(async () => {
  if (db) {
    const uploads = await db.upload.findMany({ where: { project: { slug } } });
    for (const upload of uploads) {
      const job = await app.get(UploadQueue).queue.getJob(upload.id);
      await job?.remove();
    }
    await db.project.deleteMany({ where: { slug } });
  }
  if (app) await app.close();
});
describe('API with real PostgreSQL and Redis', () => {
  test('health is public; admin and uploads are protected', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200);
    await request(app.getHttpServer())
      .post('/api/projects')
      .send({ name: 'x', slug })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/uploads')
      .send(body)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ password: 'incorrect' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', 'https://untrusted.example')
      .send({ password: 'integration-password' })
      .expect(403);
  });
  test('login creates an HttpOnly session and tokens are hashed', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ password: 'integration-password' })
      .expect(200);
    const cookies = login.headers['set-cookie'];
    if (!cookies?.[0]) throw new Error('Missing session cookie');
    cookie = cookies[0];
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    await request(app.getHttpServer())
      .post('/api/projects')
      .set('Cookie', cookie)
      .send({ name: 'Integration sample', slug })
      .expect(201);
    const created = await request(app.getHttpServer())
      .post(`/api/projects/${slug}/tokens`)
      .set('Cookie', cookie)
      .send({ label: 'CI' })
      .expect(201);
    token = created.body.token as string;
    tokenId = created.body.id as string;
    const saved = await db.apiToken.findUniqueOrThrow({
      where: { id: tokenId },
    });
    expect(saved.tokenHash).not.toBe(token);
    expect(saved.tokenHash).toHaveLength(64);
    const listed = await request(app.getHttpServer())
      .get(`/api/projects/${slug}/tokens`)
      .set('Cookie', cookie)
      .expect(200);
    expect(JSON.stringify(listed.body)).not.toContain(token);
  });
  test('validates reports and ingests gzip idempotently under concurrent requests', async () => {
    await request(app.getHttpServer())
      .post('/api/uploads')
      .auth(token, { type: 'bearer' })
      .send({ ...body, report: {} })
      .expect(400);
    const results = await Promise.all(
      [1, 2].map(() =>
        request(app.getHttpServer())
          .post('/api/uploads')
          .auth(token, { type: 'bearer' })
          .send(body),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 202]);
    expect(results[0]?.body.id).toBe(results[1]?.body.id);
    const uploadId = results[0]?.body.id as string;
    expect(await app.get(UploadQueue).queue.getJob(uploadId)).toBeTruthy();
    const server = await app.listen(0, '127.0.0.1');
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Missing test server port');
    const compressed = await fetch(
      `http://127.0.0.1:${address.port}/api/uploads`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Encoding': 'gzip',
        },
        body: gzipSync(JSON.stringify({ ...body, ciRunId: 'gzip' })),
      },
    );
    expect(compressed.status).toBe(202);
  });
  test('revoked tokens cannot upload', async () => {
    await request(app.getHttpServer())
      .delete(`/api/projects/${slug}/tokens/${tokenId}`)
      .set('Cookie', cookie)
      .expect(200);
    const result = await request(app.getHttpServer())
      .post('/api/uploads')
      .auth(token, { type: 'bearer' })
      .send(body)
      .expect(401);
    expect(result.body.code).toBe('TOKEN_REVOKED');
  });
});
