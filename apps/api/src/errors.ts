import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { ZodError } from 'zod';
import type { Response } from 'express';
export function fail(status: number, code: string, message: string): never {
  throw new HttpException({ code, message }, status);
}
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (error instanceof ZodError)
      return response
        .status(400)
        .json({ code: 'INVALID_INPUT', message: 'Check the supplied fields.' });
    if (error instanceof HttpException) {
      const body = error.getResponse();
      return response
        .status(error.getStatus())
        .json(
          typeof body === 'object' && 'code' in body
            ? body
            : { code: 'REQUEST_FAILED', message: error.message },
        );
    }
    const status =
      typeof error === 'object' && error !== null && 'status' in error
        ? error.status
        : undefined;
    if (status === 413)
      return response.status(413).json({
        code: 'REPORT_TOO_LARGE',
        message: 'Report exceeds the 10 MB limit.',
      });
    if (status === 400)
      return response.status(400).json({
        code: 'INVALID_JSON',
        message: 'Request body is not valid JSON.',
      });
    console.error(
      'Request failed:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return response.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    });
  }
}
