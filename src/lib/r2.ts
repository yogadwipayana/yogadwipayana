import {
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let _client: S3Client | null = null;

/**
 * Cloudflare R2 is S3-compatible, so we keep using the AWS SDK — only the
 * endpoint, region, and credentials differ. Region must be the literal
 * "auto" (required by the SDK, ignored by R2), and the endpoint points at the
 * account's R2 gateway: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
 */
export const r2 = () => {
  if (_client) return _client;

  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId) {
    throw new Error("R2_ACCOUNT_ID environment variable is not set");
  }

  _client = new S3Client({
    region: "auto",
    endpoint:
      process.env.R2_ENDPOINT?.trim() ||
      `https://${accountId}.r2.cloudflarestorage.com`,
    credentials:
      process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
          }
        : undefined,
  });
  return _client;
};

export const R2_BUCKET = process.env.R2_BUCKET ?? "";

function assertBucket() {
  if (!R2_BUCKET) {
    throw new Error("R2_BUCKET environment variable is not set");
  }
}

/** Upload bytes to R2 under `key`. Used by the upload route and generators. */
export async function putObject(opts: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}): Promise<void> {
  assertBucket();
  await r2().send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: opts.key,
      Body: opts.body,
      ContentType: opts.contentType,
    }),
  );
}

/** Fetch an object's bytes + content type from R2. Throws if it doesn't exist. */
export async function getObjectBytes(
  key: string,
): Promise<{ body: Buffer; contentType: string | undefined }> {
  assertBucket();
  const res = await r2().send(
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
  );
  if (!res.Body) {
    throw new Error(`R2 object has no body: ${key}`);
  }
  const bytes = await res.Body.transformToByteArray();
  return { body: Buffer.from(bytes), contentType: res.ContentType };
}

/** True if an object exists in the bucket. Used to validate own attachments. */
export async function objectExists(key: string): Promise<boolean> {
  assertBucket();
  try {
    await r2().send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** Create a short-lived presigned URL for downloading a private object. */
export async function createPresignedDownloadUrl(opts: {
  key: string;
  expiresIn?: number;
}) {
  assertBucket();
  const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: opts.key });
  return getSignedUrl(r2(), command, { expiresIn: opts.expiresIn ?? 300 });
}

/**
 * Same-origin URL that streams an R2 object back through our proxy route
 * (`/api/files/<key>`). The bucket stays private — bytes are served by the
 * route after an R2 GetObject, so no public bucket access is required.
 */
export function fileProxyUrl(key: string): string {
  return `/api/files/${key}`;
}

/**
 * Reverse of fileProxyUrl: extract the R2 key from one of our proxy URLs
 * (absolute or relative). Returns null for anything that isn't our proxy path,
 * and rejects path traversal. Used by read-side consumers (vision, validation)
 * to recognize and re-fetch our own stored files.
 */
export function keyFromProxyUrl(rawUrl: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(rawUrl, "http://local").pathname;
  } catch {
    return null;
  }
  const prefix = "/api/files/";
  if (!pathname.startsWith(prefix)) return null;
  const key = decodeURIComponent(pathname.slice(prefix.length));
  if (!key || key.includes("..")) return null;
  return key;
}
