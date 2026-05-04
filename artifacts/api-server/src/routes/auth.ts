import { Router } from "express";
import { db, staffTable, passwordResetsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "crypto";

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
    setoresAtuacao:     user.setoresAtuacao,
    turno:              user.turno,
    consultorio:        user.consultorio,
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

router.post("/forgot-password", async (req, res) => {
  const { login } = req.body as { login?: string };

  if (!login) {
    res.status(400).json({ error: "Login é obrigatório" });
    return;
  }

  const [user] = await db
    .select()
    .from(staffTable)
    .where(eq(staffTable.login, login));

  if (user && user.active) {
    const token     = randomBytes(32).toString("hex");
    const id        = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.insert(passwordResetsTable).values({
      id,
      userId: user.id,
      token,
      expiresAt,
    });

    const resetLink = `/reset-password?token=${token}`;
    req.log.info({ msg: "Password reset requested", user: user.login, resetLink });
    console.log(`[RESET] ${user.name} (${user.login}) → ${resetLink}`);
  }

  res.json({ ok: true });
});

router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body as { token?: string; password?: string };

  if (!token || !password || password.length < 8) {
    res.status(400).json({ error: "Token e senha são obrigatórios" });
    return;
  }

  const now = new Date();
  const [reset] = await db
    .select()
    .from(passwordResetsTable)
    .where(
      and(
        eq(passwordResetsTable.token, token),
        gt(passwordResetsTable.expiresAt, now),
      ),
    );

  if (!reset) {
    res.status(400).json({ error: "Link inválido ou expirado. Solicite um novo link." });
    return;
  }

  if (reset.usedAt) {
    res.status(400).json({ error: "Este link já foi utilizado. Solicite um novo." });
    return;
  }

  const newHash = await bcrypt.hash(password, 12);

  await db
    .update(staffTable)
    .set({ passwordHash: newHash, mustChangePassword: false, updatedAt: new Date() })
    .where(eq(staffTable.id, reset.userId));

  await db
    .update(passwordResetsTable)
    .set({ usedAt: now })
    .where(eq(passwordResetsTable.id, reset.id));

  res.json({ ok: true });
});

export default router;
