import type { Request, Response, NextFunction } from "express";
import { db, auditLogTable } from "@workspace/db";
import { logger } from "../lib/logger";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function describeAction(method: string, url: string): string {
  const path = (url.split("?")[0] ?? "").replace(/\/\d+/g, "/:id");
  return `${method.toUpperCase()} ${path}`;
}

export function auditWrite(req: Request, res: Response, next: NextFunction): void {
  if (!WRITE_METHODS.has(req.method)) {
    next();
    return;
  }

  res.on("finish", () => {
    if (res.statusCode >= 200 && res.statusCode < 300 && req.staff) {
      const ip =
        (req.headers["x-forwarded-for"] as string | undefined)
          ?.split(",")[0]
          ?.trim() ??
        req.socket?.remoteAddress ??
        null;

      const acao = describeAction(req.method, req.originalUrl ?? req.url ?? "");
      const paramsStr =
        req.params && Object.keys(req.params).length > 0
          ? JSON.stringify(req.params)
          : null;

      db.insert(auditLogTable)
        .values({
          staffId: req.staff.id,
          usuario: req.staff.name,
          acao,
          detalhes: paramsStr,
          ip,
        })
        .catch((err: unknown) =>
          logger.error({ err }, "Falha ao registrar auditoria"),
        );
    }
  });

  next();
}
