import { CreateBucketCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';

const bucket = process.env.S3_BUCKET ?? 'trim-attachments';
const client = new S3Client({
  region: process.env.S3_REGION ?? 'us-east-1',
  endpoint: process.env.S3_ENDPOINT ?? 'http://127.0.0.1:9000',
  forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'trim',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'trimsecret',
  },
});

try {
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  console.log(`Bucket ${bucket} already exists.`);
} catch {
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
  console.log(`Created bucket ${bucket}.`);
}
