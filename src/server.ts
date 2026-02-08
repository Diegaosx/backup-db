import express, { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";

import { env } from "./env.js";
import { listBackups, restoreBackup } from "./restore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Evita crash por EPIPE quando o cliente (ex.: health check do Railway) fecha a conexão antes da resposta
app.use((req, res, next) => {
  const ignoreEpipe = (err: NodeJS.ErrnoException) => {
    if (err?.code === "EPIPE" || err?.errno === -32) return;
    console.error("socket/res error:", err);
  };
  res.on("error", ignoreEpipe);
  req.socket?.on("error", ignoreEpipe);
  next();
});

app.use(express.json({ limit: "1mb" }));

// Health check para o Railway responder rápido e não dar timeout
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).send("ok");
});

type JwtPayload = { sub: string };

function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-api-key"] as string | undefined;
  if (apiKey && apiKey === env.API_KEY) {
    return next();
  }
  const bearer = req.headers.authorization;
  const token = bearer?.startsWith("Bearer ") ? bearer.slice(7) : undefined;
  if (!token) {
    return res.status(401).json({ error: "API_KEY (x-api-key) ou Bearer token obrigatório." });
  }
  try {
    jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
}

app.post("/api/auth/login", (req: Request, res: Response) => {
  const { apiKey } = req.body ?? {};
  if (!apiKey || apiKey !== env.API_KEY) {
    return res.status(401).json({ error: "API_KEY inválida." });
  }
  const token = jwt.sign(
    { sub: "restore" },
    env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  return res.json({ token });
});

app.get("/api/backups", authMiddleware, async (_req: Request, res: Response) => {
  try {
    const backups = await listBackups();
    return res.json({ backups });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/api/restore", authMiddleware, (req: Request, res: Response) => {
  const { backupKey, databaseUrl } = req.body ?? {};
  if (!backupKey || typeof backupKey !== "string") {
    return res.status(400).json({ error: "backupKey é obrigatório." });
  }
  if (!databaseUrl || typeof databaseUrl !== "string") {
    return res.status(400).json({ error: "databaseUrl é obrigatório (URL do Postgres de destino)." });
  }
  if (!databaseUrl.startsWith("postgresql://") && !databaseUrl.startsWith("postgres://")) {
    return res.status(400).json({ error: "databaseUrl deve ser uma connection string PostgreSQL (postgresql://...)." });
  }
  // Restore pode levar vários minutos; executa em segundo plano para evitar 502/timeout do gateway
  res.status(202).json({
    success: true,
    message:
      "Restauração iniciada em segundo plano. Pode levar alguns minutos. Verifique o banco de destino ou os logs do serviço.",
  });
  restoreBackup(backupKey, databaseUrl)
    .then((result) => {
      if (result.ok) {
        console.log("[restore] Concluído:", result.message);
      } else {
        console.error("[restore] Falha:", result.message);
      }
    })
    .catch((err) => {
      console.error("[restore] Erro:", err);
    });
});

app.use(express.static(path.join(__dirname, "..", "public")));
app.get("*", (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

const port = Number(env.PORT) || 3000;
export function startRestoreServer() {
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`Servidor de restore em http://0.0.0.0:${port}`);
  });
  server.on("connection", (socket: import("net").Socket) => {
    socket.on("error", (err: NodeJS.ErrnoException) => {
      if (err?.code === "EPIPE" || err?.errno === -32) return;
      console.error("connection error:", err);
    });
  });
  server.on("clientError", (err: Error, socket: import("stream").Duplex) => {
    socket.destroy();
  });
}
