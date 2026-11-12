import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { Database } from '../database';
import { fail } from '../errors';
@Injectable()
export class ProjectsService {
  constructor(@Inject(Database) private readonly db: Database) {}
  async find(slug: string) {
    const project = await this.db.project.findUnique({ where: { slug } });
    if (!project) fail(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    return project;
  }
  async create(name: string, slug: string) {
    try {
      return await this.db.project.create({ data: { name, slug } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        fail(409, 'PROJECT_EXISTS', 'This slug is already in use.');
      throw error;
    }
  }
  async tokens(slug: string) {
    const project = await this.find(slug);
    return this.db.apiToken.findMany({
      where: { projectId: project.id },
      select: {
        id: true,
        label: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  async createToken(slug: string, label: string) {
    const project = await this.find(slug);
    const token = `ftr_${randomBytes(32).toString('hex')}`;
    const saved = await this.db.apiToken.create({
      data: {
        projectId: project.id,
        label,
        tokenHash: createHash('sha256').update(token).digest('hex'),
      },
    });
    return { id: saved.id, label, token };
  }
  async revoke(slug: string, id: string) {
    const project = await this.find(slug);
    const result = await this.db.apiToken.updateMany({
      where: { id, projectId: project.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!result.count) fail(404, 'TOKEN_NOT_FOUND', 'Active token not found.');
    return { revoked: true };
  }
}
