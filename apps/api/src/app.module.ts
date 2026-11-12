import { QueriesController } from './queries/queries.controller';
import { QueriesService } from './queries/queries.service';
import { Controller, Get, Module } from '@nestjs/common';
import { Database } from './database';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { AdminGuard } from './auth/guards';
import { ProjectsController } from './projects/projects.controller';
import { ProjectsService } from './projects/projects.service';
import { UploadQueue } from './uploads/queue.service';
import { UploadsController } from './uploads/uploads.controller';
import { UploadsService } from './uploads/uploads.service';
@Controller('health')
class HealthController {
  @Get() health() {
    return { status: 'ok' };
  }
}
@Module({
  controllers: [
    QueriesController,
    HealthController,
    AuthController,
    ProjectsController,
    UploadsController,
  ],
  providers: [
    QueriesService,
    Database,
    AuthService,
    AdminGuard,
    ProjectsService,
    UploadQueue,
    UploadsService,
  ],
})
export class AppModule {}
