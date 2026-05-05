import app from "./app";
import { logger } from "./lib/logger";
import { initializeDatabase } from "./lib/db-init";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, () => {
  logger.info({ port }, "Server listening");

  initializeDatabase()
    .then(() => {
      logger.info("Database initialization complete");
    })
    .catch((err) => {
      logger.error({ err }, "Database initialization failed (non-fatal, server remains up)");
    });
});
