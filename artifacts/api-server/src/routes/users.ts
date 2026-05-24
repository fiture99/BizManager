import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { z } from "zod";

const router: IRouter = Router();

const CreateUserBody = z.object({
  username: z.string().min(2).max(50),
  password: z.string().min(6),
  role: z.enum(["inputter", "approver", "admin"]),
});

const UpdateUserBody = z.object({
  role: z.enum(["inputter", "approver", "admin"]).optional(),
  password: z.string().min(6).optional(),
});

router.get("/users", requireAuth, requireRole("admin"), async (_req, res) => {
  const users = await db
    .select({ id: usersTable.id, username: usersTable.username, role: usersTable.role, createdAt: usersTable.createdAt })
    .from(usersTable);
  res.json(users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })));
});

router.post("/users", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  const { username, password, role } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const [user] = await db
      .insert(usersTable)
      .values({ username, passwordHash, role })
      .returning({ id: usersTable.id, username: usersTable.username, role: usersTable.role, createdAt: usersTable.createdAt });
    res.status(201).json({ ...user, createdAt: user.createdAt.toISOString() });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("unique")) {
      res.status(409).json({ error: "Username already exists" });
    } else {
      throw err;
    }
  }
});

router.patch("/users/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  if (req.user?.userId === id) {
    res.status(400).json({ error: "You cannot edit your own account" });
    return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const updates: Partial<{ role: string; passwordHash: string }> = {};
  if (parsed.data.role) updates.role = parsed.data.role;
  if (parsed.data.password) updates.passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, id))
    .returning({ id: usersTable.id, username: usersTable.username, role: usersTable.role, createdAt: usersTable.createdAt });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ ...user, createdAt: user.createdAt.toISOString() });
});

router.delete("/users/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }
  if (req.user?.userId === id) {
    res.status(400).json({ error: "You cannot delete your own account" });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.status(204).end();
});

export default router;
