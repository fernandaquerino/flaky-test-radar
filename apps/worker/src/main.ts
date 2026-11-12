import 'dotenv/config';
import 'reflect-metadata';
import { Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { Worker } from 'bullmq';
import { redisConnection, UPLOAD_QUEUE } from '@flaky-radar/shared';
import { processUpload } from './process-upload';
@Injectable()
class Consumer implements OnModuleDestroy {
  private readonly db = new PrismaClient();
  private readonly worker = new Worker<{ uploadId: string }>(
    UPLOAD_QUEUE,
    async (job) => {
      try {
        await processUpload(this.db, job.data.uploadId);
      } catch (error) {
        if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1))
          await this.db.upload.updateMany({
            where: { id: job.data.uploadId, status: { not: 'PROCESSED' } },
            data: {
              status: 'FAILED',
              error:
                'Processing failed after retries. Check the report shape and worker database connectivity.',
            },
          });
        throw error;
      }
    },
    {
      connection: redisConnection(
        process.env.REDIS_URL ?? 'redis://localhost:6379',
      ),
      concurrency: 4,
      prefix: process.env.RADAR_QUEUE_PREFIX ?? 'radar',
    },
  );
  constructor() {
    this.worker.on('ready', () => console.log('Worker ready'));
    this.worker.on('error', () =>
      console.error('Worker connection error; reconnecting.'),
    );
    this.worker.on('failed', (job) =>
      console.error(
        `Upload processing attempt failed: ${job?.id ?? 'unknown'}`,
      ),
    );
  }
  async onModuleDestroy() {
    await this.worker.close();
    await this.db.$disconnect();
  }
}
@Module({ providers: [Consumer] })
class WorkerModule {}
void NestFactory.createApplicationContext(WorkerModule).then((app) =>
  app.enableShutdownHooks(),
);
