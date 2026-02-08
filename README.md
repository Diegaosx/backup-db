# backup-db

Aplicação Node.js para fazer backup automático de PostgreSQL no **Cloudflare R2**, via cron.  
Baseado no template [postgres-s3-backups](https://github.com/railwayapp-templates/postgres-s3-backups), adaptado para usar apenas R2 (endpoint seguro, sem rotas públicas).

Os arquivos são salvos no bucket na pasta **`backup-db`** (subpasta configurável).

## Variáveis de ambiente

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | Sim | Access Key ID do R2 |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Sim | Secret Access Key do R2 |
| `CLOUDFLARE_R2_BUCKET_NAME` | Sim | Nome do bucket (ex: `auc`) |
| `CLOUDFLARE_R2_ENDPOINT` | Sim | Endpoint **seguro** do R2, ex: `https://<ACCOUNT_ID>.r2.cloudflarestorage.co` — **não use a URL pública** |
| `BACKUP_DATABASE_URL` | Sim | Connection string do PostgreSQL |
| `BACKUP_CRON_SCHEDULE` | Não | Cron do backup (padrão: `0 5 * * *`) |
| `RUN_ON_STARTUP` | Não | Se `true`, roda um backup ao iniciar |
| `BACKUP_FILE_PREFIX` | Não | Prefixo do arquivo (padrão: `backup`) |
| `BUCKET_SUBFOLDER` | Não | Subpasta no bucket (padrão: `backup-db`) |
| `SINGLE_SHOT_MODE` | Não | Se `true`, faz um backup e encerra |
| `SUPPORT_OBJECT_LOCK` | Não | Habilita MD5 para object lock |
| `BACKUP_OPTIONS` | Não | Opções extras do `pg_dump` |

**Nota:** `CLOUDFLARE_R2_PUBLIC_URL` e `CLOUDFLARE_R2_PUBLIC_URL_IMOVEIS` **não são usadas** neste app; o upload é feito sempre pelo endpoint seguro (`CLOUDFLARE_R2_ENDPOINT`).

## Desenvolvimento

```bash
npm install
npm run build
# Defina as variáveis de ambiente e:
npm start
```

## Docker

```bash
docker build -t backup-db .
docker run --env-file .env backup-db
```

## Onde ficam os backups

- Bucket: o definido em `CLOUDFLARE_R2_BUCKET_NAME`
- Pasta: `backup-db` (ou o valor de `BUCKET_SUBFOLDER`)
- Exemplo de key no R2: `backup-db/backup-2025-02-07T12-00-00-000Z.tar.gz`
