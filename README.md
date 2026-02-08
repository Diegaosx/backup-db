# backup-db

Aplicação Node.js para fazer backup automático de PostgreSQL no **Cloudflare R2**, via cron.  
Baseado no template [postgres-s3-backups](https://github.com/railwayapp-templates/postgres-s3-backups), adaptado para usar apenas R2 (endpoint seguro, sem rotas públicas).

Os arquivos são salvos no bucket na pasta **`backup-db`** (subpasta configurável).

## Variáveis de ambiente

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | Sim | Access Key ID do R2 (**~32 caracteres**). Não use o Secret aqui. |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Sim | Secret Access Key do R2 (**~64 caracteres**). Não use o Access Key ID aqui. |
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
| `BACKUP_VERBOSE` | Não | Se `true`, o log lista cada tabela dumpada (útil para conferir se o backup está completo). |
| `PG_VERSION` | Não | Versão do cliente PostgreSQL no Docker (padrão: `17`). Deve ser **igual ou maior** que a versão do servidor. |
| **Restaurar (frontend)** | | |
| `RESTORE_ENABLED` | Não | Se `true`, sobe o servidor HTTP com frontend e API de restauração (padrão: `false`). |
| `API_KEY` | Se restore | Chave para autenticar no frontend/API (login e header `x-api-key`). Mínimo 16 caracteres. |
| `JWT_SECRET` | Se restore | Segredo para assinar JWTs do login. Mínimo 16 caracteres. |
| `PORT` | Não | Porta do servidor HTTP quando `RESTORE_ENABLED=true` (padrão: `3000`; Railway define `PORT`). |

### Backup menor que o esperado (ex.: banco 2 GB, arquivo 32 MB)

- **`BACKUP_OPTIONS`** — Se tiver `--schema=...`, `--exclude-table=...` ou `--exclude-table-data=...`, parte do banco fica de fora. Confira no Railway se essa variável está vazia ou só com o que você quer.
- **Banco certo** — Confirme que `BACKUP_DATABASE_URL` aponta para o banco que você acha que tem 2 GB (e não outro DB do mesmo cluster).
- **Tamanho no disco vs lógico** — Os 2 GB costumam ser “tamanho em disco” (índices, TOAST, bloat). O dump lógico + gzip pode ser bem menor, mas 32 MB ainda é uma redução forte; vale checar os itens acima.
- **Ver o que entrou no dump** — Defina `BACKUP_VERBOSE=true`, rode um backup e veja no log do Railway a lista de tabelas dumpadas. Assim você confere se as tabelas grandes estão incluídas.

**Credenciais R2:** No painel do Cloudflare (R2 → Manage R2 API Tokens), o **Access Key ID** é o valor **curto** (~32 caracteres) e o **Secret Access Key** é o valor **longo** (~64 caracteres). Se aparecer erro "access key has length 128, should be 32", as duas variáveis estão trocadas.

**Nota:** `CLOUDFLARE_R2_PUBLIC_URL` e `CLOUDFLARE_R2_PUBLIC_URL_IMOVEIS` **não são usadas** neste app; o upload é feito sempre pelo endpoint seguro (`CLOUDFLARE_R2_ENDPOINT`).

## Restaurar pelo frontend (RESTORE_ENABLED=true)

1. No Railway (ou onde rodar), defina:
   - `RESTORE_ENABLED=true`
   - `API_KEY` = uma chave secreta (ex.: 32 caracteres)
   - `JWT_SECRET` = outro segredo para JWTs (ex.: 32 caracteres)
   - O Railway já define `PORT`; em local use `PORT=3000` ou deixe o padrão.
2. Acesse a URL do serviço (ex.: `https://backup-db.railway.app`). Abre a tela de login.
3. **Login:** informe a mesma `API_KEY` que está na variável. Ao validar, você recebe um JWT e entra na tela de restore.
4. **Restaurar:** escolha o backup na lista (vinda do R2), cole a **DATABASE_URL** do Postgres de destino (ex.: `postgresql://user:pass@host:5432/db`) e clique em **Restaurar**. O app baixa o backup do R2 e roda `pg_restore` contra essa URL.

A API também aceita autenticação por header **`x-api-key`** (valor = `API_KEY`) em `GET /api/backups` e `POST /api/restore`, para uso por scripts ou outros serviços.

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

## Restaurar em um PostgreSQL novo

O backup é um dump em formato **tar** compactado com **gzip** (`.tar.gz`). Para restaurar em um banco novo:

### 1. Baixar o arquivo do R2

- **Pelo painel do Cloudflare:** R2 → seu bucket → pasta `backup-db` → clique no objeto → Download.
- **Pela linha de comando (AWS CLI compatível com R2):**
  ```bash
  export AWS_ACCESS_KEY_ID="seu_access_key_id"
  export AWS_SECRET_ACCESS_KEY="sua_secret_access_key"
  aws s3 cp s3://SEU_BUCKET/backup-db/backup-XXXX.tar.gz . --endpoint-url https://SEU_ACCOUNT_ID.r2.cloudflarestorage.com
  ```

### 2. Criar o banco no PostgreSQL de destino

No servidor onde você quer restaurar (Postgres novo, Railway, etc.):

```bash
# Se tiver psql/createdb na máquina (ou dentro do container do Postgres):
createdb -h HOST -U USER "nome_do_banco_novo"
# ou via psql:
psql -h HOST -U USER -d postgres -c "CREATE DATABASE nome_do_banco_novo;"
```

Use o mesmo usuário que terá permissão para criar tabelas e objetos.

### 3. Restaurar o dump

Na máquina onde está o arquivo `.tar.gz`, com cliente PostgreSQL instalado (ex.: `postgresql-client` no Alpine/Linux ou pg no Windows):

```bash
# URL do banco NOVO (onde você quer restaurar)
export RESTORE_URL="postgresql://USER:PASSWORD@HOST:5432/nome_do_banco_novo"

# Descompacta e restaura (formato tar)
gunzip -c backup-XXXX.tar.gz | pg_restore -d "$RESTORE_URL" --no-owner --no-acl
```

- **`--no-owner`** — não tenta recriar os donos originais (evita erro se o usuário do banco antigo não existir no novo).
- **`--no-acl`** — ignora ACLs do dump (recomendado em ambiente novo).

Se aparecer avisos de “already exists” (por exemplo de extensões), em geral pode ignorar. Erros de “permission denied” costumam ser de usuário/role: use um usuário com permissão de criar objetos no banco.

### 4. Conferir

```bash
psql "$RESTORE_URL" -c "\dt"
```

Deve listar as tabelas restauradas.
