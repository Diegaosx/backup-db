import { envsafe, str, bool } from "envsafe";

export const env = envsafe({
  CLOUDFLARE_R2_ACCESS_KEY_ID: str({
    desc: "Cloudflare R2 access key ID.",
  }),
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: str({
    desc: "Cloudflare R2 secret access key.",
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
});
