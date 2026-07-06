import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

type ErrorResponseBody = {
  success: false;
  statusCode: number;
  errorCode: string;
  message: string;
  details?: unknown;
  timestamp: string;
  path: string;
};

type ExceptionPayload = {
  error?: unknown;
  error_code?: unknown;
  errorCode?: unknown;
  message?: unknown;
  details?: unknown;
};

const statusToCode = (statusCode: number) => {
  switch (statusCode) {
    case HttpStatus.BAD_REQUEST:
      return 'BAD_REQUEST';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'UNPROCESSABLE_ENTITY';
    default:
      return statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_FAILED';
  }
};

const firstMessage = (message: unknown, fallback: string) => {
  if (Array.isArray(message)) {
    const first = message.find((item): item is string => typeof item === 'string' && item.trim().length > 0);
    return first ?? fallback;
  }

  if (typeof message === 'string' && message.trim().length > 0) {
    return message;
  }

  return fallback;
};

const codeFromMessage = (message: string, fallback: string) => {
  if (/^[A-Z0-9_:-]+$/.test(message)) {
    return message.split(':')[0];
  }
  return fallback;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{ status: (code: number) => { json: (body: ErrorResponseBody) => void } }>();
    const request = ctx.getRequest<{ url?: string }>();

    const statusCode = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const fallbackCode = statusToCode(statusCode);
    const fallbackMessage = statusCode >= 500 ? 'Internal server error' : fallbackCode;

    let errorCode = fallbackCode;
    let message = fallbackMessage;
    let details: unknown;

    if (exception instanceof HttpException) {
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        message = firstMessage(payload, fallbackMessage);
        errorCode = codeFromMessage(message, fallbackCode);
      } else if (payload && typeof payload === 'object') {
        const body = payload as ExceptionPayload;
        message = firstMessage(body.message, fallbackMessage);
        errorCode =
          typeof body.error_code === 'string'
            ? body.error_code
            : typeof body.errorCode === 'string'
              ? body.errorCode
              : codeFromMessage(message, fallbackCode);

        if (body.details !== undefined) {
          details = body.details;
        } else if (Array.isArray(body.message)) {
          details = { validationErrors: body.message };
        }
      }
    } else {
      this.logger.error(
        exception instanceof Error ? exception.message : 'Unhandled non-error exception',
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      errorCode,
      message,
      ...(details !== undefined ? { details } : {}),
      timestamp: new Date().toISOString(),
      path: request.url ?? '',
    });
  }
}
