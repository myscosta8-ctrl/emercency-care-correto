import { Router } from "express";
import { db, staffTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { requirePermissao } from "../middleware/require-auth";

const router = Router();

const serialize = (s: typeof staffTable.$inferSelect) => ({
  id: s.id,
  name: s.name,
  role: s.role,
  email: s.email,
  active: s.active,
  corenCrm: s.corenCrm,
  sector: s.sector,
  login: s.login,
  mustChangePassword: s.mustChangePassword,
  accessLevels: s.accessLevels,
  signature: s.signature,
  stamp: s.stamp,
  setoresAtuacao: s.setoresAtuacao,
  turno: s.turno,
  consultorio: s.consultorio,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
});

router.get("/", async (req, res) => {
  const members = await db.select().from(staffTable).orderBy(staffTable.name);
  res.json(members.map(serialize));
});

router.post("/", requirePermissao("gerenciar_usuarios"), async (req, res) => {
  const { ...rest } = req.body as {
    name: string;
    role: string;
    email?: string;
    active?: boolean;
    corenCrm?: string;
    sector?: string;
    login: string;
    accessLevels?: string;
    signature?: string;
    stamp?: string;
    setoresAtuacao?: string;
    turno?: string;
    consultorio?: string;
  };

  if (!rest.name || !rest.role || !rest.login) {
    res.status(400).json({ error: "name, role e login são obrigatórios" });
    return;
  }

  const passwordHash = await bcrypt.hash("1234", 12);

  const [created] = await db
    .insert(staffTable)
    .values({
      name: rest.name,
      role: rest.role as typeof staffTable.$inferInsert["role"],
      email: rest.email ?? "",
      active: rest.active ?? true,
      corenCrm: rest.corenCrm ?? "",
      sector: rest.sector ?? "",
      login: rest.login,
      passwordHash,
      mustChangePassword: true,
      accessLevels: rest.accessLevels ?? "",
      signature: rest.signature ?? "",
      stamp: rest.stamp ?? "",
      setoresAtuacao: rest.setoresAtuacao ?? "todos",
      turno: rest.turno ?? "",
      consultorio: rest.consultorio ?? "",
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

router.put("/:id", requirePermissao("gerenciar_usuarios"), async (req, res) => {
  const id = Number(req.params["id"]);
  const { role: roleRaw, ...rest } = req.body as {
    name?: string;
    role?: string;
    email?: string;
    active?: boolean;
    corenCrm?: string;
    sector?: string;
    login?: string;
    accessLevels?: string;
    signature?: string;
    stamp?: string;
    setoresAtuacao?: string;
    turno?: string;
    consultorio?: string;
  };

  const patch: Partial<typeof staffTable.$inferInsert> = {
    ...rest,
    ...(roleRaw ? { role: roleRaw as typeof staffTable.$inferInsert["role"] } : {}),
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

router.delete("/:id", requirePermissao("gerenciar_usuarios"), async (req, res) => {
  const id = Number(req.params["id"]);
  const [deleted] = await db.delete(staffTable).where(eq(staffTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

export default router;
