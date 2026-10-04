import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '../../../.env') });

async function bootstrap(): Promise<void> {
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('./app.module');
  const { loadEnv } = await import('./env');
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: env.WEB_ORIGIN });
  await app.listen(env.API_PORT);
  console.log(`Serenity API listening on http://localhost:${env.API_PORT}`);
}

void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
