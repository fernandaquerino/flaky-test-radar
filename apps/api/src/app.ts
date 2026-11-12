import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AppModule } from './app.module';
import { ErrorFilter } from './errors';
export async function createApp() {
  if (
    (process.env.SESSION_SECRET?.length ?? 0) < 32 ||
    !process.env.ADMIN_PASSWORD_HASH?.startsWith('scrypt:')
  )
    throw new Error(
      'Configure SESSION_SECRET (32+ characters) and ADMIN_PASSWORD_HASH.',
    );
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: ['error', 'warn'],
  });
  app.setGlobalPrefix('api');
  app.use(json({ limit: '10mb', inflate: true }));
  app.use(
    '/api/auth/login',
    rateLimit({
      windowMs: 15 * 60000,
      limit: 10,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        code: 'TOO_MANY_ATTEMPTS',
        message: 'Try signing in again in 15 minutes.',
      },
    }),
  );
  app.use(
    (
      req: import('express').Request,
      res: import('express').Response,
      next: import('express').NextFunction,
    ) => {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (
        !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
        req.headers.origin &&
        req.headers.origin !==
          (process.env.WEB_ORIGIN ?? 'http://localhost:3000')
      )
        return res.status(403).json({
          code: 'ORIGIN_FORBIDDEN',
          message: 'Untrusted request origin.',
        });
      next();
    },
  );
  app.useGlobalFilters(new ErrorFilter());
  app.enableShutdownHooks();
  await app.init();
  return app;
}
