import { createReadStream } from "node:fs";
import type { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "../../config/env.js";

type ObjectMeta = {
  sizeBytes: number;
  contentType: string;
};

type ObjectStreamResult = {
  body: Readable;
  contentType: string;
  contentLength: number;
  contentRange?: string;
};

const toReadable = (body: unknown): Readable => {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid object response body");
  }
  if ("pipe" in body && typeof (body as { pipe?: unknown }).pipe === "function") {
    return body as Readable;
  }
  throw new Error("Unsupported object response stream type");
};

export class ObjectStorageService {
  private readonly bucket: string | undefined;
  private readonly client: S3Client | undefined;

  constructor() {
    const {
      endpoint,
      bucket,
      accessKeyId,
      secretAccessKey,
      region,
    } = env.tigris;
    this.bucket = bucket;

    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
      return;
    }

    this.client = new S3Client({
      region,
      endpoint,
      forcePathStyle: false,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  isConfigured(): boolean {
    return Boolean(this.client && this.bucket);
  }

  assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error(
        "Tigris storage is not configured. Set TIGRIS_ENDPOINT, TIGRIS_BUCKET, TIGRIS_ACCESS_KEY_ID, and TIGRIS_SECRET_ACCESS_KEY.",
      );
    }
  }

  async uploadFromFile(
    key: string,
    localPath: string,
    contentType: string,
  ): Promise<void> {
    this.assertConfigured();
    await this.client!.send(
      new PutObjectCommand({
        Bucket: this.bucket!,
        Key: key,
        Body: createReadStream(localPath),
        ContentType: contentType,
      }),
    );
  }

  async statObject(key: string): Promise<ObjectMeta> {
    this.assertConfigured();
    const result = await this.client!.send(
      new HeadObjectCommand({
        Bucket: this.bucket!,
        Key: key,
      }),
    );
    return {
      sizeBytes: result.ContentLength ?? 0,
      contentType: result.ContentType ?? "application/octet-stream",
    };
  }

  async getObjectStream(
    key: string,
    byteRange?: string,
  ): Promise<ObjectStreamResult> {
    this.assertConfigured();
    const result = await this.client!.send(
      new GetObjectCommand({
        Bucket: this.bucket!,
        Key: key,
        Range: byteRange,
      }),
    );
    const payload: ObjectStreamResult = {
      body: toReadable(result.Body),
      contentType: result.ContentType ?? "application/octet-stream",
      contentLength: result.ContentLength ?? 0,
    };
    if (result.ContentRange) {
      payload.contentRange = result.ContentRange;
    }
    return payload;
  }

  async deleteObject(key: string): Promise<void> {
    this.assertConfigured();
    await this.client!.send(
      new DeleteObjectCommand({
        Bucket: this.bucket!,
        Key: key,
      }),
    );
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    this.assertConfigured();

    let token: string | undefined;
    do {
      const listed = await this.client!.send(
        new ListObjectsV2Command({
          Bucket: this.bucket!,
          Prefix: prefix,
          ContinuationToken: token,
        }),
      );
      token = listed.NextContinuationToken;

      const objects = (listed.Contents ?? [])
        .map((o) => o.Key)
        .filter((k): k is string => Boolean(k))
        .map((k) => ({ Key: k }));

      if (objects.length > 0) {
        await this.client!.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket!,
            Delete: { Objects: objects },
          }),
        );
      }
    } while (token);
  }
}

