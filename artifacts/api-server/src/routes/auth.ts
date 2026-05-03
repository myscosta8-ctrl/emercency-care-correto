import { Router } from "express";
import { db, staffTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

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
    .where(eq(staffTable.login, login));

  if (!user) {
    res.status(401).json({ error: "Credenciais inválidas" });
    return;
  }

  if (!user.active) {
    res.status(403).json({ error: "Usuário inativo. Contate o administrador." });
    return;
  }

  const isBcrypt = user.passwordHash.startsWith("$2b$") || user.passwordHash.startsWith("$2a$");
  let valid = false;
  if (isBcrypt) {
    valid = await bcrypt.compare(password, user.passwordHash);
  } else {
    valid = user.passwordHash === password;
  }

  if (!valid) {
    res.status(401).json({ error: "Credenciais inválidas" });
    return;
  }

  res.json({
    id:                 user.id,
    login:              user.login,
    name:               user.name,
    role:               user.role,
    sector:             user.sector,
    corenCrm:           user.corenCrm,
    mustChangePassword: user.mustChangePassword,
  });
});

router.post("/change-password", async (req, res) => {
  const staffId = req.headers["x-staff-id"];
  if (!staffId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }

  const { password } = req.body as { password?: string };
  if (!password || password.length < 8) {
    res.status(400).json({ error: "Senha inválida" });
    return;
  }

  const id = Number(staffId);
  const newHash = await bcrypt.hash(password, 12);

  const [updated] = await db
    .update(staffTable)
    .set({ passwordHash: newHash, mustChangePassword: false, updatedAt: new Date() })
    .where(eq(staffTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }

  res.json({ ok: true });
});

export default router;
