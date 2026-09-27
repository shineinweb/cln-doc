import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { loadApiEnv } from "@agency/shared";
import { AppModule } from "./app.module";

async function bootstrap() {
  const env = loadApiEnv(process.env);
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
  });
  await app.listen(env.PORT);
  console.log(`API listening on http://localhost:${env.PORT}`);
}

void bootstrap();
