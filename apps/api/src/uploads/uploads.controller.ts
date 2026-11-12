import { Body, Controller, Inject, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { UploadsService } from './uploads.service';
@Controller('uploads')
export class UploadsController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(UploadsService) private readonly uploads: UploadsService,
  ) {}
  @Post() async receive(
    @Req() req: Request,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.uploads.receive(
      await this.auth.project(req),
      body,
    );
    res.status(result.duplicate ? 200 : 202);
    return result.body;
  }
}
