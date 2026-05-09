import { createServer } from "./server.js";
import { env } from "./env.js";
import { prisma } from "./db.js";

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("👍 PostgresDB connected");
  } catch (err) {
    console.error("👎 PostgresDB connection FAILED:", err instanceof Error ? err.message : err);
  }
}

const app = createServer();

const server = app.listen(env.PORT, async () => {
  console.log(`naksha-backend listening on http://localhost:${env.PORT}`);
  await checkDatabase();
});

const shutdown = (signal: string) => {
  console.log(`${signal} received, shutting down...`);
  server.close(() => process.exit(0));
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
