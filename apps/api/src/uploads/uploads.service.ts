import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { uploadSchema } from '@flaky-radar/shared';
import { Database } from '../database';
import { fail } from '../errors';
import { UploadQueue } from './queue.service';
@Injectable()
export class UploadsService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(UploadQueue) private readonly queue: UploadQueue,
  ) {}
  async receive(projectId: string, body: unknown) {
    const parsed = uploadSchema.safeParse(body);
    if (!parsed.success)
      fail(400, 'INVALID_REPORT', 'Invalid Playwright report or CI metadata.');
    const { report, ...metadata } = parsed.data;
    let duplicate = false;
    const where = {
      projectId_ciRunId_attempt: {
        projectId,
        ciRunId: metadata.ciRunId,
        attempt: metadata.attempt,
      },
    };
    let upload;
    try {
      upload = await this.db.upload.create({
        data: {
          projectId,
          ...metadata,
          rawReport: JSON.parse(
            JSON.stringify(report),
          ) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      )
        throw error;
      duplicate = true;
      upload = await this.db.upload.findUniqueOrThrow({ where });
    }
    if (upload.status === 'RECEIVED') {
      try {
        await this.queue.enqueue(upload.id);
      } catch {
        fail(
          503,
          'QUEUE_UNAVAILABLE',
          'Upload is stored; retry with the same run ID and attempt.',
        );
      }
    }
    return {
      duplicate,
      body: {
        id: upload.id,
        status: upload.status,
        code: duplicate ? 'UPLOAD_ALREADY_RECEIVED' : 'UPLOAD_ACCEPTED',
      },
    };
  }
}
