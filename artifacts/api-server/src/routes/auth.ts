import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { signToken, requireAuth } from "../lib/auth";
import { z } from "zod";

const router: IRouter = Router();

const LoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }
  const { username, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const token = signToken({ userId: user.id, username: user.username, role: user.role as "inputter" | "approver" | "admin" });

  res.json({
    token,
    user: { userId: user.id, username: user.username, role: user.role },
  });
});

router.get("/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
