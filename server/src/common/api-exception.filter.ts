import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from "@nestjs/common";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  constructor(private readonly production: boolean) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<{ originalUrl?: string; url?: string }>();
    const response = http.getResponse<{
      getHeader(name: string): number | string | string[] | undefined;
      status(code: number): { json(body: unknown): void };
    }>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException ? exception.getResponse() : {};
    const details = typeof raw === "object" && raw !== null
      ? raw as Record<string, unknown>
      : { message: String(raw) };
    const requestId = String(response.getHeader("X-Request-Id") ?? "");
    const path = request.originalUrl ?? request.url ?? "";
    const message = status >= 500 && this.production
      ? "An unexpected server error occurred."
      : details.message ?? (exception instanceof Error ? exception.message : "Request failed.");
    const error = details.error ?? HttpStatus[status] ?? "Error";

    if (status >= 500) {
      this.logger.error({
        requestId,
        path,
        statusCode: status,
        message: exception instanceof Error ? exception.message : String(exception),
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    }

    response.status(status).json({
      ...details,
      statusCode: status,
      error,
      message,
      code: `HTTP_${status}`,
      requestId,
      path,
      timestamp: new Date().toISOString(),
    });
  }
}
