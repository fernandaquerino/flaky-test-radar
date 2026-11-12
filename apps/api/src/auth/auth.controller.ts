import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { AuthService, COOKIE, SESSION_MS } from './auth.service';
import { AdminGuard } from './guards';
const options = () => ({
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/api',
});
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  @Post('login')
  @HttpCode(200)
  login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const { password } = z
      .object({ password: z.string().min(1).max(1024) })
      .parse(body);
    res.cookie(COOKIE, this.auth.login(password), {
      ...options(),
      maxAge: SESSION_MS,
    });
    return { authenticated: true };
  }
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE, options());
    return { authenticated: false };
  }
  @Get('session')
  @UseGuards(AdminGuard)
  session() {
    return { authenticated: true };
  }
}
