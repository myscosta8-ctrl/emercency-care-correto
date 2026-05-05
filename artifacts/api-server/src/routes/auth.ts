import { Router } from "express";
import { db, staffTable, passwordResetsTable } from "@workspace/db";
import { eq, and, gt, isNull, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "crypto";

const router = Router();

router.post("/login", async (req, res) => {
  const { login, password } = req.body as { login?: string; password?: string };

  if (!login || !password) {
    res.status(400).json({ error: "Login e senha são obrigatórios" });
    return;
  }

  let user: typeof staffTable.$inferSelect | undefined;
  try {
    const rows = await db
      .select()
      .from(staffTable)
      .where(eq(staffTable.login, login));
    user = rows[0];
  } catch (err) {
    req.log.error({ err }, "Database error during login query");
    res.status(503).json({ error: "Serviço temporariamente indisponível. Tente novamente." });
    return;
  }

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
    const { createHash } = await import("crypto");
    const sha256 = createHash("sha256").update(password).digest("hex");
    valid = sha256 === user.passwordHash || user.passwordHash === password;
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

  try {
    const [user] = await db
      .select()
      .from(staffTable)
      .where(eq(staffTable.login, login));

    if (user && user.active) {
      const token     = randomBytes(32).toString("hex");
      const id        = randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await db.insert(passwordResetsTable).values({ id, userId: user.id, token, expiresAt });
      req.log.info({ msg: "Password reset requested", user: user.login, token });
    }
  } catch (err) {
    req.log.error({ err }, "Error processing password reset request");
  }

  res.json({ ok: true });
});

router.get("/password-resets", async (req, res) => {
  const staffId = req.headers["x-staff-id"];
  if (!staffId) { res.status(401).json({ error: "Não autenticado" }); return; }

  try {
    const [requester] = await db.select({ role: staffTable.role })
      .from(staffTable).where(eq(staffTable.id, Number(staffId)));
    if (!requester || requester.role !== "administrador") {
      res.status(403).json({ error: "Acesso negado" }); return;
    }

    const now = new Date();
    const resets = await db
      .select({
        id:        passwordResetsTable.id,
        token:     passwordResetsTable.token,
        userId:    passwordResetsTable.userId,
        expiresAt: passwordResetsTable.expiresAt,
        createdAt: passwordResetsTable.createdAt,
        userName:  staffTable.name,
        userLogin: staffTable.login,
      })
      .from(passwordResetsTable)
      .innerJoin(staffTable, eq(passwordResetsTable.userId, staffTable.id))
      .where(and(gt(passwordResetsTable.expiresAt, now), isNull(passwordResetsTable.usedAt)))
      .orderBy(desc(passwordResetsTable.createdAt));

    res.json(resets);
  } catch (err) {
    req.log.error({ err }, "Error fetching password resets");
    res.status(503).json({ error: "Erro ao buscar solicitações" });
  }
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
