import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";
import { randomUUID } from "node:crypto";

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const requestId = randomUUID();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const detail =
        typeof payload === "string"
          ? payload
          : ((payload as { message?: string | string[] }).message ?? exception.message);

      response.status(status).json({
        type: `https://api.agency.local/errors/${status}`,
        title: exception.name,
        status,
        detail: Array.isArray(detail) ? detail.join(", ") : detail,
        code: status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : "HTTP_ERROR",
        requestId,
        ...(typeof payload === "object" && payload !== null
          ? { errors: (payload as { errors?: unknown }).errors }
          : {}),
      });
      return;
    }

    console.error(exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      type: "https://api.agency.local/errors/500",
      title: "Internal Server Error",
      status: 500,
      detail: "An unexpected error occurred",
      code: "INTERNAL_ERROR",
      requestId,
    });
  }
}
