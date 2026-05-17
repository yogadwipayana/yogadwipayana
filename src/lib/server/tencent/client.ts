import crypto from "crypto";
import { ApiError } from "@/lib/server/api-response";

const ENDPOINT = "https://lighthouse.intl.tencentcloudapi.com/";
const SERVICE = "lighthouse";
const VERSION = "2020-03-24";

export type TencentCredentials = {
  secretId: string;
  secretKey: string;
  region: string;
};

type TencentResponse<T> = {
  Response: T & {
    RequestId?: string;
    Error?: { Code?: string; Message?: string };
  };
};

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function hmac(key: Buffer | string, msg: string) {
  return crypto.createHmac("sha256", key).update(msg, "utf8").digest();
}

function getAuthorization(
  action: string,
  payload: string,
  timestamp: number,
  secretId: string,
  secretKey: string
) {
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const canonicalHeaders =
    "content-type:application/json; charset=utf-8\nhost:lighthouse.intl.tencentcloudapi.com\n";
  const signedHeaders = "content-type;host";
  const hashedPayload = sha256Hex(payload);
  const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`;
  const credentialScope = `${date}/${SERVICE}/tc3_request`;
  const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${sha256Hex(
    canonicalRequest
  )}`;

  const secretDate = hmac(`TC3${secretKey}`, date);
  const secretService = hmac(secretDate, SERVICE);
  const secretSigning = hmac(secretService, "tc3_request");
  const signature = crypto
    .createHmac("sha256", secretSigning)
    .update(stringToSign, "utf8")
    .digest("hex");

  const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    authorization,
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json; charset=utf-8",
      "X-TC-Action": action,
      "X-TC-Version": VERSION,
      "X-TC-Timestamp": String(timestamp),
    },
  };
}

export async function callTencent<TResponse = Record<string, unknown>>(
  action: string,
  payload: Record<string, unknown>,
  creds: TencentCredentials
) {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const { headers } = getAuthorization(
    action,
    body,
    timestamp,
    creds.secretId,
    creds.secretKey
  );

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      ...headers,
      "X-TC-Region": creds.region,
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiError(
      502,
      "PROVIDER_HTTP_ERROR",
      `Tencent API request failed with status ${response.status}`
    );
  }

  const data = (await response.json()) as TencentResponse<TResponse>;
  const error = data?.Response?.Error;
  if (error) {
    const codeSuffix = error.Code ? ` (Code: ${error.Code})` : "";
    throw new ApiError(400, "PROVIDER_API_ERROR", `${error.Message || "Tencent API error"}${codeSuffix}`, {
      providerCode: error.Code,
      action,
    });
  }

  return data.Response;
}
