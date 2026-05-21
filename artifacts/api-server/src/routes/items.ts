import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, itemsTable, inventoryLevelsTable } from "@workspace/db";
import {
  CreateItemBody,
  GetItemParams,
  GetItemResponse,
  UpdateItemParams,
  UpdateItemBody,
  UpdateItemResponse,
  DeleteItemParams,
  ListItemsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/items", async (req, res): Promise<void> => {
  const items = await db.select().from(itemsTable).orderBy(itemsTable.name);
  res.json(ListItemsResponse.parse(items.map(i => ({
    ...i,
    unitPrice: Number(i.unitPrice),
    costPrice: Number(i.costPrice),
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  }))));
});

router.post("/items", async (req, res): Promise<void> => {
  const parsed = CreateItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [item] = await db.insert(itemsTable).values({
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    category: parsed.data.category,
    unitPrice: String(parsed.data.unitPrice),
    costPrice: String(parsed.data.costPrice),
    unitOfMeasure: parsed.data.unitOfMeasure,
  }).returning();

  // Auto-create inventory level at 0
  await db.insert(inventoryLevelsTable).values({
    itemId: item.id,
    quantityOnHand: "0",
    reorderPoint: "0",
  }).onConflictDoNothing();

  res.status(201).json(GetItemResponse.parse({
    ...item,
    unitPrice: Number(item.unitPrice),
    costPrice: Number(item.costPrice),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));
});

router.get("/items/:id", async (req, res): Promise<void> => {
  const params = GetItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [item] = await db.select().from(itemsTable).where(eq(itemsTable.id, params.data.id));
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  res.json(GetItemResponse.parse({
    ...item,
    unitPrice: Number(item.unitPrice),
    costPrice: Number(item.costPrice),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));
});

router.patch("/items/:id", async (req, res): Promise<void> => {
  const params = UpdateItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.category !== undefined) updateData.category = parsed.data.category;
  if (parsed.data.unitPrice !== undefined) updateData.unitPrice = String(parsed.data.unitPrice);
  if (parsed.data.costPrice !== undefined) updateData.costPrice = String(parsed.data.costPrice);
  if (parsed.data.unitOfMeasure !== undefined) updateData.unitOfMeasure = parsed.data.unitOfMeasure;

  const [item] = await db.update(itemsTable).set(updateData).where(eq(itemsTable.id, params.data.id)).returning();
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  res.json(UpdateItemResponse.parse({
    ...item,
    unitPrice: Number(item.unitPrice),
    costPrice: Number(item.costPrice),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));
});

router.delete("/items/:id", async (req, res): Promise<void> => {
  const params = DeleteItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [item] = await db.delete(itemsTable).where(eq(itemsTable.id, params.data.id)).returning();
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
