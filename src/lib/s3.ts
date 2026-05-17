import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let _client: S3Client | null = null;

export const s3 = () => {
  if (_client) return _client;
  _client = new S3Client({
    region: process.env.AWS_REGION ?? "us-east-1",
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined, // fall back to IAM role on EC2
  });
  return _client;
};

export const S3_BUCKET = process.env.S3_BUCKET ?? "";

/**
 * Create a short-lived presigned URL for uploading a single object.
 * The client PUTs the file directly to S3 — bytes never cross our server.
 */
export async function createPresignedUploadUrl(opts: {
  key: string;
  contentType: string;
  expiresIn?: number; // seconds, default 60
}) {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: opts.key,
    ContentType: opts.contentType,
  });
  return getSignedUrl(s3(), command, { expiresIn: opts.expiresIn ?? 60 });
}

/** Create a short-lived presigned URL for downloading a private object. */
export async function createPresignedDownloadUrl(opts: {
  key: string;
  expiresIn?: number;
}) {
  const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: opts.key });
  return getSignedUrl(s3(), command, { expiresIn: opts.expiresIn ?? 300 });
}

/** Public URL for objects readable via CloudFront / bucket policy. */
export function publicUrl(key: string) {
  const base = process.env.NEXT_PUBLIC_S3_PUBLIC_URL;
  if (base) return `${base.replace(/\/$/, "")}/${key}`;
  const region = process.env.AWS_REGION ?? "us-east-1";
  return `https://${S3_BUCKET}.s3.${region}.amazonaws.com/${key}`;
}
