import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { redisConnection, UPLOAD_QUEUE } from '@flaky-radar/shared';
import { Database } from '../database';
@Injectable()
export class UploadQueue implements OnModuleInit, OnModuleDestroy {
  readonly queue = new Queue(UPLOAD_QUEUE, {
    prefix: process.env.RADAR_QUEUE_PREFIX ?? 'radar',
    connection: {
      ...redisConnection(process.env.REDIS_URL ?? 'redis://localhost:6379'),
      maxRetriesPerRequest: 1,
    },
  });
  private timer?: ReturnType<typeof setInterval>;
  private recovering = false;
  constructor(@Inject(Database) private readonly db: Database) {}
  async enqueue(id: string) {
    await this.queue.add(
      'parse',
      { uploadId: id },
      {
        jobId: id,
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      },
    );
  }
  async recover() {
    if (this.recovering) return;
    this.recovering = true;
    try {
      const uploads = await this.db.upload.findMany({
        where: { status: 'RECEIVED' },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });
      for (const upload of uploads) await this.enqueue(upload.id);
    } finally {
      this.recovering = false;
    }
  }
  onModuleInit() {
    this.queue.on('error', () =>
      console.error('Upload queue connection unavailable.'),
    );
    this.timer = setInterval(() => {
      void this.recover().catch(() =>
        console.error('Upload queue recovery will retry.'),
      );
    }, 15000);
    this.timer.unref();
  }
  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.queue.close();
  }
}
