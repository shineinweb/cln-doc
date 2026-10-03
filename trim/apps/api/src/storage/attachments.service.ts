import { Inject, Injectable } from '@nestjs/common';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { loadEnv } from '../env';
import { ATTACHMENT_STORAGE } from './storage.token';

@Injectable()
export class AttachmentsService {
  private readonly bucket = loadEnv().S3_BUCKET;

  constructor(@Inject(ATTACHMENT_STORAGE) private readonly s3: S3Client) {}

  async put(objectKey: string, body: Buffer, contentType: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async get(objectKey: string): Promise<Buffer> {
    const result = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }));
    if (!result.Body) {
      throw new Error(`Attachment object ${objectKey} was empty.`);
    }
    return Buffer.from(await result.Body.transformToByteArray());
  }

  async delete(objectKey: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }));
  }
}
