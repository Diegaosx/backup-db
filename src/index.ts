import { CronJob } from "cron";
import { backup } from "./backup.js";
import { env } from "./env.js";

console.log("Node:", process.version);

const tryBackup = async () => {
  try {
    await backup();
  } catch (error) {
    console.error("Erro ao executar backup:", error);
    process.exit(1);
  }
};

if (env.RUN_ON_STARTUP || env.SINGLE_SHOT_MODE) {
  console.log("Executando backup na inicialização...");
  await tryBackup();

  if (env.SINGLE_SHOT_MODE) {
    console.log("Backup concluído. Encerrando.");
    process.exit(0);
  }
}

const job = new CronJob(env.BACKUP_CRON_SCHEDULE, async () => {
  await tryBackup();
});

job.start();
console.log("Cron de backup agendado.");
