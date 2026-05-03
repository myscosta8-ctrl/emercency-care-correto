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

function getStaffId(req: Request): number | null {
  const header = req.headers["x-staff-id"];
  if (!header) return null;
  const id = parseInt(String(header), 10);
  return isNaN(id) ? null : id;
}

/**
 * Loads the authenticated staff member from the x-staff-id header.
 * Blocks ALL requests (reads and writes) that lack a valid, active staff identity.
 * Must be applied after the /auth routes so login itself is not blocked.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const staffId = getStaffId(req);

  if (staffId === null) {
    res.status(401).json({ error: "Autenticação necessária" });
    return;
  }

  db.select()
    .from(staffTable)
    .where(eq(staffTable.id, staffId))
    .limit(1)
    .then(([staff]) => {
      if (!staff) {
        res.status(401).json({ error: "Usuário não encontrado" });
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

/**
 * Checks that the authenticated staff member has the given permission.
 * Must be used after requireAuth in the middleware chain.
 */
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
