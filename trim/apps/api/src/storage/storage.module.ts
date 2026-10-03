import { Logger, Module } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { loadEnv } from '../env';

export const ATTACHMENT_STORAGE = Symbol('ATTACHMENT_STORAGE');

@Module({
  providers: [
    {
      provide: ATTACHMENT_STORAGE,
      useFactory: (): S3Client => {
        const env = loadEnv();
        const client = new S3Client({
          region: env.S3_REGION,
          endpoint: env.S3_ENDPOINT,
          forcePathStyle: env.S3_FORCE_PATH_STYLE,
          credentials: {
            accessKeyId: env.S3_ACCESS_KEY,
            secretAccessKey: env.S3_SECRET_KEY,
          },
        });
        Logger.log(
          `Attachment bucket "${env.S3_BUCKET}" configured at ${env.S3_ENDPOINT}. Upload features are not enabled.`,
          'Storage',
        );
        return client;
      },
    },
  ],
  exports: [ATTACHMENT_STORAGE],
})
export class StorageModule {}
