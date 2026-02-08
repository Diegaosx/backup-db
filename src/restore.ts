import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { createWriteStream, unlink, existsSync } from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

import { env } from "./env.js";

function getR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: env.CLOUDFLARE_R2_ENDPOINT,
    credentials: {
      accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    },
  });
}

const prefix = env.BUCKET_SUBFOLDER ? `${env.BUCKET_SUBFOLDER}/` : "";

export interface BackupItem {
  key: string;
  name: string;
  lastModified: string;
  size: number;
}

export async function listBackups(): Promise<BackupItem[]> {
  const client = getR2Client();
  const list: BackupItem[] = [];
  let continuationToken: string | undefined;

  do {
    const cmd = new ListObjectsV2Command({
      Bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    const out = await client.send(cmd);
    for (const obj of out.Contents ?? []) {
      if (obj.Key && (obj.Key.endsWith(".tar.gz") || obj.Key.endsWith(".tar"))) {
        list.push({
          key: obj.Key,
          name: path.basename(obj.Key),
          lastModified: (obj.LastModified?.toISOString() ?? ""),
          size: obj.Size ?? 0,
        });
      }
    }
    continuationToken = out.NextContinuationToken;
  } while (continuationToken);

  list.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
  return list;
}

export async function restoreBackup(backupKey: string, databaseUrl: string): Promise<{ ok: boolean; message: string }> {
  const client = getR2Client();
  const tempFile = path.join(os.tmpdir(), `restore-${Date.now()}.tar.gz`);

  try {
    const getCmd = new GetObjectCommand({
      Bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: backupKey,
    });
    const obj = await client.send(getCmd);
    const body = obj.Body as Readable | undefined;
    if (!body) {
      return { ok: false, message: "Backup vazio ou inacessível no R2." };
    }

    const outStream = createWriteStream(tempFile);
    await pipeline(body, outStream);

    return await new Promise((resolve) => {
      const gunzip = spawn("gunzip", ["-c", tempFile], { stdio: ["ignore", "pipe", "pipe"] });
      const pgRestore = spawn("pg_restore", ["-d", databaseUrl, "--no-owner", "--no-acl"], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      gunzip.stdout?.pipe(pgRestore.stdin!);

      let stderr = "";
      gunzip.stderr?.on("data", (c: Buffer) => { stderr += c.toString(); });
      pgRestore.stderr?.on("data", (c: Buffer) => { stderr += c.toString(); });

      pgRestore.on("close", (code) => {
        if (existsSync(tempFile)) unlink(tempFile, () => {});
        if (code === 0) {
          resolve({ ok: true, message: "Restauração concluída." });
        } else {
          resolve({ ok: false, message: stderr || `pg_restore saiu com código ${code}.` });
        }
      });

      const onError = (err: Error) => {
        if (existsSync(tempFile)) unlink(tempFile, () => {});
        resolve({ ok: false, message: err.message });
      };
      gunzip.on("error", onError);
      pgRestore.on("error", onError);
    });
  } catch (err) {
    if (existsSync(tempFile)) unlink(tempFile, () => {});
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}
