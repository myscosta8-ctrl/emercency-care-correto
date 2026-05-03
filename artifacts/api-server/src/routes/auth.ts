import { Router } from "express";
import { db, staffTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.post("/login", async (req, res) => {
  const { login, password } = req.body as { login?: string; password?: string };

  if (!login || !password) {
    res.status(400).json({ error: "Login e senha são obrigatórios" });
    return;
  }

  const [user] = await db
    .select()
    .from(staffTable)
    .where(and(eq(staffTable.login, login), eq(staffTable.passwordHash, password)));

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
