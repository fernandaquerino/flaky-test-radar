import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { testQuerySchema } from '@flaky-radar/shared';
import { AdminGuard } from '../auth/guards';
import { QueriesService } from './queries.service';
@Controller('projects')
@UseGuards(AdminGuard)
export class QueriesController {
  constructor(
    @Inject(QueriesService) private readonly queries: QueriesService,
  ) {}
  @Get() list() {
    return this.queries.listProjects();
  }
  @Get(':slug/tests') tests(
    @Param('slug') slug: string,
    @Query() query: unknown,
  ) {
    return this.queries.tests(slug, testQuerySchema.parse(query));
  }
  @Get(':slug/tests/:testId') detail(
    @Param('slug') slug: string,
    @Param('testId') id: string,
  ) {
    return this.queries.detail(slug, id);
  }
}
