import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AdminGuard } from '../auth/guards';
import { ProjectsService } from './projects.service';
@Controller('projects')
@UseGuards(AdminGuard)
export class ProjectsController {
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
  ) {}
  @Post() create(@Body() body: unknown) {
    const input = z
      .object({
        name: z.string().trim().min(1).max(100),
        slug: z
          .string()
          .min(1)
          .max(80)
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      })
      .parse(body);
    return this.projects.create(input.name, input.slug);
  }
  @Get(':slug/tokens') tokens(@Param('slug') slug: string) {
    return this.projects.tokens(slug);
  }
  @Post(':slug/tokens') token(
    @Param('slug') slug: string,
    @Body() body: unknown,
  ) {
    const input = z
      .object({ label: z.string().trim().min(1).max(80) })
      .parse(body);
    return this.projects.createToken(slug, input.label);
  }
  @Delete(':slug/tokens/:id') revoke(
    @Param('slug') slug: string,
    @Param('id') id: string,
  ) {
    return this.projects.revoke(slug, id);
  }
}
