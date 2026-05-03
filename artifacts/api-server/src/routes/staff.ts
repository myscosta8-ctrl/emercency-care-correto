import { Router } from "express";
import { db, staffTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";

const router = Router();

function hashPassword(plain: string): string {
  return createHash("sha256").update(plain + "upa_salt_2026").digest("hex");
}

const serialize = (s: typeof staffTable.$inferSelect) => ({
  id: s.id,
  nome: s.nome,
  perfil: s.perfil,
  email: s.email,
  ativo: s.ativo,
  corenCrm: s.corenCrm,
  sector: s.sector,
  login: s.login,
  accessLevels: s.accessLevels,
  signature: s.signature,
  stamp: s.stamp,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
});

router.get("/", async (req, res) => {
  const members = await db.select().from(staffTable).orderBy(staffTable.nome);
  res.json(members.map(serialize));
});

router.post("/", async (req, res) => {
  const { password, ...rest } = req.body as {
    nome: string;
    perfil: string;
    email?: string;
    ativo?: boolean;
    corenCrm?: string;
    sector?: string;
    login: string;
    password: string;
    accessLevels?: string;
    signature?: string;
    stamp?: string;
  };

  if (!rest.nome || !rest.perfil || !rest.login || !password) {
    res.status(400).json({ error: "nome, perfil, login and password are required" });
    return;
  }

  const [created] = await db
    .insert(staffTable)
    .values({
      nome: rest.nome,
      perfil: rest.perfil as "recepcionista" | "enfermeiro" | "tecnico_enfermagem" | "medico" | "assistente_social" | "nutricionista" | "farmaceutico" | "administrador",
      email: rest.email ?? "",
      ativo: rest.ativo ?? true,
      corenCrm: rest.corenCrm ?? "",
      sector: rest.sector ?? "",
      login: rest.login,
      passwordHash: hashPassword(password),
      accessLevels: rest.accessLevels ?? "",
      signature: rest.signature ?? "",
      stamp: rest.stamp ?? "",
    })
    .returning();

  res.status(201).json(serialize(created));
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  const [member] = await db.select().from(staffTable).where(eq(staffTable.id, id));
  if (!member) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(member));
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  const { password, perfil: perfilRaw, ...rest } = req.body as {
    nome?: string;
    perfil?: string;
    email?: string;
    ativo?: boolean;
    corenCrm?: string;
    sector?: string;
    login?: string;
    password?: string;
    accessLevels?: string;
    signature?: string;
    stamp?: string;
  };

  const patch: Partial<typeof staffTable.$inferInsert> = {
    ...rest,
    ...(perfilRaw ? { perfil: perfilRaw as "recepcionista" | "enfermeiro" | "tecnico_enfermagem" | "medico" | "assistente_social" | "nutricionista" | "farmaceutico" | "administrador" } : {}),
    ...(password ? { passwordHash: hashPassword(password) } : {}),
    updatedAt: new Date(),
  };

  const [updated] = await db
    .update(staffTable)
    .set(patch)
    .where(eq(staffTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(updated));
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  const [deleted] = await db.delete(staffTable).where(eq(staffTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

export default router;
