import type { Request, Response, NextFunction } from "express";
import { db, staffTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { temPermissaoServer } from "../lib/server-permissions";

declare global {
  namespace Express {
    interface Request {
      staff?: typeof staffTable.$inferSelect;
    }
  }
}

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function getStaffId(req: Request): number | null {
  const header = req.headers["x-staff-id"];
  if (!header) return null;
  const id = parseInt(String(header), 10);
  return isNaN(id) ? null : id;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const staffId = getStaffId(req);
  const isWrite = WRITE_METHODS.has(req.method);

  if (staffId === null) {
    if (isWrite) {
      res.status(401).json({ error: "Autenticação necessária" });
      return;
    }
    next();
    return;
  }

  db.select()
    .from(staffTable)
    .where(eq(staffTable.id, staffId))
    .limit(1)
    .then(([staff]) => {
      if (!staff) {
        if (isWrite) {
          res.status(401).json({ error: "Usuário não encontrado" });
          return;
        }
        next();
        return;
      }
      if (!staff.active) {
        res.status(403).json({ error: "Conta inativa" });
        return;
      }
      req.staff = staff;
      next();
    })
    .catch(next);
}

export function requirePermissao(acao: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.staff) {
      res.status(401).json({ error: "Autenticação necessária" });
      return;
    }
    if (!temPermissaoServer(req.staff.role, acao)) {
      res.status(403).json({ error: `Permissão insuficiente para: ${acao}` });
      return;
    }
    next();
  };
}
