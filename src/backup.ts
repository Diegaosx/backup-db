import { exec, execSync } from "child_process";
import {
  S3Client,
  PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { createReadStream, unlink, statSync } from "fs";
import { filesize } from "filesize";
import path from "path";
import os from "os";

import { env } from "./env.js";
import { createMD5 } from "./util.js";

/**
 * Upload para Cloudflare R2 via endpoint seguro (CLOUDFLARE_R2_ENDPOINT).
 * Não usa URLs públicas (CLOUDFLARE_R2_PUBLIC_URL*).
 */
const uploadToR2 = async ({
  name,
  path: filePath,
}: {
  name: string;
  path: string;
}) => {
  console.log("Enviando backup para Cloudflare R2...");

  const key = env.BUCKET_SUBFOLDER
    ? `${env.BUCKET_SUBFOLDER}/${name}`
    : name;

  const client = new S3Client({
    region: "auto",
    endpoint: env.CLOUDFLARE_R2_ENDPOINT,
    credentials: {
      accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    },
  });

  let params: PutObjectCommandInput = {
    Bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
    Key: key,
    Body: createReadStream(filePath),
  };

  if (env.SUPPORT_OBJECT_LOCK) {
    console.log("Calculando MD5...");
    const md5Hash = await createMD5(filePath);
    console.log("MD5 calculado.");
    params.ContentMD5 = Buffer.from(md5Hash, "hex").toString("base64");
  }

  await new Upload({
    client,
    params,
  }).done();

  console.log(`Backup enviado para R2 (${env.CLOUDFLARE_R2_BUCKET_NAME}/${key}).`);
};

const dumpToFile = async (filePath: string) => {
  console.log("Exportando banco para arquivo...");

  await new Promise((resolve, reject) => {
    exec(
      `pg_dump --dbname=${env.BACKUP_DATABASE_URL} --format=tar ${env.BACKUP_OPTIONS} | gzip > ${filePath}`,
      (error, stdout, stderr) => {
        if (error) {
          reject({ error, stderr: stderr?.trimEnd() });
          return;
        }

        const isValidArchive =
          execSync(`gzip -cd ${filePath} | head -c1`).length === 1;
        if (!isValidArchive) {
          reject({
            error:
              "Arquivo de backup inválido ou vazio; verifique erros acima",
          });
          return;
        }

        if (stderr != "") {
          console.log({ stderr: stderr.trimEnd() });
        }

        console.log("Arquivo de backup válido.");
        console.log("Tamanho:", filesize(statSync(filePath).size));

        if (stderr != "") {
          console.log(
            `Possíveis avisos; confira se "${path.basename(filePath)}" contém todos os dados necessários.`
          );
        }

        resolve(undefined);
      }
    );
  });

  console.log("Exportação concluída.");
};

const deleteFile = async (filePath: string) => {
  console.log("Removendo arquivo temporário...");
  await new Promise<void>((resolve, reject) => {
    unlink(filePath, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

export const backup = async () => {
  console.log("Iniciando backup do banco...");

  const date = new Date().toISOString();
  const timestamp = date.replace(/[:.]+/g, "-");
  const filename = `${env.BACKUP_FILE_PREFIX}-${timestamp}.tar.gz`;
  const filepath = path.join(os.tmpdir(), filename);

  await dumpToFile(filepath);
  await uploadToR2({ name: filename, path: filepath });
  await deleteFile(filepath);

  console.log("Backup concluído.");
};
