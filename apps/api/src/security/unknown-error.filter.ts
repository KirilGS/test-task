import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from "@nestjs/common";
import { BaseExceptionFilter, HttpAdapterHost } from "@nestjs/core";

export const UNKNOWN_ERROR_MESSAGE = "Внутренняя ошибка сервера. Попробуйте ещё раз";

@Injectable()
@Catch()
export class UnknownErrorFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(UnknownErrorFilter.name);

  constructor(adapterHost: HttpAdapterHost) {
    super(adapterHost.httpAdapter);
  }

  override catch(exception: unknown, host: ArgumentsHost): void {
    if (exception instanceof HttpException) {
      super.catch(exception, host);
      return;
    }

    this.logger.error(redactForLog(exception));
    const applicationRef = this.applicationRef;
    if (applicationRef === undefined) {
      return;
    }
    const response: unknown = host.getArgByIndex(1);
    if (!applicationRef.isHeadersSent(response)) {
      applicationRef.reply(response, { message: UNKNOWN_ERROR_MESSAGE }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

export function redactForLog(error: unknown): string {
  const text =
    error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ""}` : "Неизвестная ошибка";
  return text
    .replace(/mongodb(?:\+srv)?:\/\/\S+/gi, "mongodb://скрыто")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}/g, "ключ-скрыт");
}
