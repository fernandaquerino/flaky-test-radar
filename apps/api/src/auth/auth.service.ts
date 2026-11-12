import { Inject, Injectable } from '@nestjs/common';
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import type { Request } from 'express';
import { Database } from '../database';
import { fail } from '../errors';
import { verifyPassword } from './password';
export const COOKIE = 'radar_session';
export const SESSION_MS = 8 * 60 * 60 * 1000;
@Injectable()
export class AuthService {
  constructor(@Inject(Database) private readonly db: Database) {}
  private signature(value: string) {
    return createHmac('sha256', process.env.SESSION_SECRET ?? '')
      .update(`${value}:${process.env.ADMIN_PASSWORD_HASH}`)
      .digest('hex');
  }
  login(password: string) {
    if (!verifyPassword(password, process.env.ADMIN_PASSWORD_HASH ?? ''))
      fail(401, 'INVALID_CREDENTIALS', 'Incorrect password.');
    const value = `${Date.now() + SESSION_MS}.${randomBytes(24).toString('hex')}`;
    return `${value}.${this.signature(value)}`;
  }
  admin(request: Request) {
    const raw = request.headers.cookie
      ?.split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1);
    if (!raw) fail(401, 'SESSION_REQUIRED', 'Please sign in.');
    const [expires, nonce, signature] = raw.split('.');
    const expected = this.signature(`${expires}.${nonce}`);
    if (
      !signature ||
      !/^[a-f0-9]{64}$/.test(signature) ||
      !timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expected, 'hex'),
      ) ||
      !Number.isFinite(Number(expires)) ||
      Number(expires) <= Date.now()
    )
      fail(401, 'SESSION_EXPIRED', 'Please sign in again.');
  }
  async project(request: Request) {
    const bearer = request.headers.authorization;
    if (!bearer?.startsWith('Bearer '))
      fail(401, 'TOKEN_REQUIRED', 'A project bearer token is required.');
    const tokenHash = createHash('sha256')
      .update(bearer.slice(7))
      .digest('hex');
    const token = await this.db.apiToken.findUnique({ where: { tokenHash } });
    if (!token) fail(401, 'TOKEN_INVALID', 'Invalid project token.');
    if (token.revokedAt)
      fail(401, 'TOKEN_REVOKED', 'This token has been revoked.');
    await this.db.apiToken.update({
      where: { id: token.id },
      data: { lastUsedAt: new Date() },
    });
    return token.projectId;
  }
}
