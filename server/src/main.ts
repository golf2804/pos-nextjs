import "reflect-metadata";
import { ConsoleLogger, Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { randomUUID } from "node:crypto";
import helmet from "helmet";
import { AppModule } from "./app.module.js";
import { validationExceptionFactory } from "./common/validation-error.js";
import { ApiExceptionFilter } from "./common/api-exception.filter.js";
import { parseAllowedOrigins } from "./common/security-config.js";

async function bootstrap() {
  const production = process.env.NODE_ENV === "production";
  const app = await NestFactory.create(AppModule, {
    logger: production ? new ConsoleLogger({ json: true, colors: false }) : undefined,
  });
  const config = app.get(ConfigService);
  validateSecurityConfig(config);
  const origins = parseAllowedOrigins(
    config.get<string>("FRONTEND_URL", "http://localhost:3000"),
    production,
  );
  app.setGlobalPrefix("api");
  app.enableShutdownHooks();
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "no-referrer" },
  }));
  app.use((_request: unknown, response: { setHeader(name: string, value: string): void }, next: () => void) => {
    response.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
    response.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    next();
  });
  const requestLogger = new Logger("HTTP");
  app.use((request: { method: string; originalUrl?: string; headers: Record<string, string | string[] | undefined> }, response: { statusCode: number; writableEnded?: boolean; setHeader(name: string, value: string): void; on(event: string, listener: () => void): void }, next: () => void) => {
    const supplied = request.headers["x-request-id"];
    const requestId = typeof supplied === "string" && supplied.length <= 100 ? supplied : randomUUID();
    const startedAt = Date.now();
    response.setHeader("X-Request-Id", requestId);
    response.on("finish", () => requestLogger.log({
      requestId,
      method: request.method,
      path: request.originalUrl,
      statusCode: response.statusCode,
      durationMs: Date.now() - startedAt,
    }));
    response.on("close", () => {
      if (!response.writableEnded) {
        requestLogger.warn({
          requestId,
          method: request.method,
          path: request.originalUrl,
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt,
          aborted: true,
        });
      }
    });
    next();
  });
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposedHeaders: ["Content-Disposition"],
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: validationExceptionFactory,
  }));
  app.useGlobalFilters(new ApiExceptionFilter(production));
  const swaggerEnabled = config.get<string>("SWAGGER_ENABLED", production ? "false" : "true") === "true";
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("POS Inventory API")
      .setDescription("Inventory, catalog, stock movement, reporting, notifications, and user administration API")
      .setVersion("1.0.0")
      .addBearerAuth()
      .build();
    SwaggerModule.setup("api/docs", app, () => SwaggerModule.createDocument(app, swaggerConfig), {
      jsonDocumentUrl: "api/docs/openapi.json",
    });
  }
  await app.listen(config.get<number>("PORT", 4000));
}

function validateSecurityConfig(config: ConfigService) {
  const required = ["SUPABASE_URL", "SUPABASE_SECRET_KEY"];
  const missing = required.filter((key) => !config.get<string>(key));
  const hasSupabasePublicKey = Boolean(
    config.get<string>("SUPABASE_PUBLISHABLE_KEY")
      ?? config.get<string>("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
      ?? config.get<string>("SUPABASE_ANON_KEY")
      ?? config.get<string>("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
  if (!hasSupabasePublicKey) missing.push("SUPABASE_PUBLISHABLE_KEY");
  if (config.get<string>("NODE_ENV") === "production") {
    for (const key of ["DATABASE_URL", "FRONTEND_URL"]) {
      if (!config.get<string>(key)) missing.push(key);
    }
  }
  if (missing.length) throw new Error(`Missing required security configuration: ${missing.join(", ")}`);
}

void bootstrap();
