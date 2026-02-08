import { envsafe, str, bool } from "envsafe";

const raw = envsafe({
  CLOUDFLARE_R2_ACCESS_KEY_ID: str({
    desc: "Cloudflare R2 access key ID (cerca de 32 caracteres).",
  }),
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: str({
    desc: "Cloudflare R2 secret access key (cerca de 64 caracteres).",
  }),
  CLOUDFLARE_R2_BUCKET_NAME: str({
    desc: "Nome do bucket R2 onde os backups serão salvos.",
  }),
  CLOUDFLARE_R2_ENDPOINT: str({
    desc: "Endpoint R2 (uso interno/seguro). Ex: https://<ACCOUNT_ID>.r2.cloudflarestorage.com — não use a URL pública.",
  }),
  BACKUP_DATABASE_URL: str({
    desc: "Connection string do PostgreSQL a ser backupeado.",
  }),
  BACKUP_CRON_SCHEDULE: str({
    desc: "Cron para agendar o backup.",
    default: "0 5 * * *",
    allowEmpty: true,
  }),
  RUN_ON_STARTUP: bool({
    desc: "Executar um backup ao iniciar a aplicação.",
    default: false,
    allowEmpty: true,
  }),
  BACKUP_FILE_PREFIX: str({
    desc: "Prefixo do nome do arquivo de backup.",
    default: "backup",
  }),
  BUCKET_SUBFOLDER: str({
    desc: "Subpasta no bucket. Padrão: backup-db (recomendado).",
    default: "backup-db",
    allowEmpty: true,
  }),
  SINGLE_SHOT_MODE: bool({
    desc: "Executar um único backup e encerrar.",
    default: false,
    allowEmpty: true,
  }),
  SUPPORT_OBJECT_LOCK: bool({
    desc: "Suporte a object lock (hash MD5 no arquivo).",
    default: false,
  }),
  BACKUP_OPTIONS: str({
    desc: "Opções válidas do pg_dump.",
    default: "",
    allowEmpty: true,
  }),
  BACKUP_VERBOSE: bool({
    desc: "Se true, pg_dump usa --verbose (lista tabelas no log). Útil para conferir se o dump está completo.",
    default: false,
    allowEmpty: true,
  }),
  RESTORE_ENABLED: bool({
    desc: "Se true, sobe o servidor HTTP com frontend e API de restauração.",
    default: false,
    allowEmpty: true,
  }),
  API_KEY: str({
    desc: "Chave para autenticar no frontend/API de restore (obrigatória se RESTORE_ENABLED=true).",
    default: "",
    allowEmpty: true,
  }),
  JWT_SECRET: str({
    desc: "Segredo para assinar JWTs do login (obrigatório se RESTORE_ENABLED=true).",
    default: "",
    allowEmpty: true,
  }),
  PORT: str({
    desc: "Porta do servidor HTTP (usada quando RESTORE_ENABLED=true). Railway define PORT automaticamente.",
    default: "3000",
    allowEmpty: true,
  }),
});

// R2/S3: Access Key ID tem ~32 caracteres; Secret tem ~64. Trocar os dois causa "access key has length 128, should be 32".
function validateR2Credentials() {
  const id = raw.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secret = raw.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  if (id.length > 50) {
    throw new Error(
      `CLOUDFLARE_R2_ACCESS_KEY_ID tem ${id.length} caracteres; o esperado é ~32. ` +
        "Você pode ter colado o Secret no lugar do Access Key ID. No Cloudflare: R2 → Manage R2 API Tokens → o valor curto é Access Key ID, o longo é Secret Access Key."
    );
  }
  if (secret.length < 40 && secret.length > 0) {
    throw new Error(
      `CLOUDFLARE_R2_SECRET_ACCESS_KEY tem ${secret.length} caracteres; o esperado é ~64. ` +
        "Confira se não inverteu com o Access Key ID."
    );
  }
}

validateR2Credentials();

if (raw.RESTORE_ENABLED) {
  if (!raw.API_KEY || raw.API_KEY.length < 16) {
    throw new Error("Quando RESTORE_ENABLED=true, defina API_KEY com pelo menos 16 caracteres.");
  }
  if (!raw.JWT_SECRET || raw.JWT_SECRET.length < 16) {
    throw new Error("Quando RESTORE_ENABLED=true, defina JWT_SECRET com pelo menos 16 caracteres.");
  }
}

export const env = raw;
