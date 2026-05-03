import { Router } from "express";
import { db, staffTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";

const router = Router();

function hashPassword(plain: string): string {
  return createHash("sha256").update(plain + "upa_salt_2026").digest("hex");
}

router.post("/login", async (req, res) => {
  const { login, password } = req.body as { login?: string; password?: string };

  if (!login || !password) {
    res.status(400).json({ error: "Login e senha são obrigatórios" });
    return;
  }

  const hash = hashPassword(password);

  const [user] = await db
    .select()
    .from(staffTable)
    .where(and(eq(staffTable.login, login), eq(staffTable.passwordHash, hash)));

  if (!user) {
    res.status(401).json({ error: "Credenciais inválidas" });
    return;
  }

  if (!user.active) {
    res.status(403).json({ error: "Usuário inativo. Contate o administrador." });
    return;
  }

  res.json({
    id:       user.id,
    login:    user.login,
    name:     user.name,
    role:     user.role,
    sector:   user.sector,
    corenCrm: user.corenCrm,
  });
});

export default router;
