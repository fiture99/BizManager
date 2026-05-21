import { Router, type IRouter } from "express";
import { eq, lte } from "drizzle-orm";
import { db, itemsTable, inventoryLevelsTable, stockAdjustmentsTable } from "@workspace/db";
import {
  GetInventoryLevelParams,
  GetInventoryLevelResponse,
  UpdateInventoryLevelParams,
  UpdateInventoryLevelBody,
  UpdateInventoryLevelResponse,
  AdjustStockParams,
  AdjustStockBody,
  ListStockAdjustmentsParams,
  ListStockAdjustmentsResponse,
  ListInventoryResponse,
  ListLowStockResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function fmtLevel(level: typeof inventoryLevelsTable.$inferSelect, item?: typeof itemsTable.$inferSelect) {
  return {
    itemId: level.itemId,
    quantityOnHand: Number(level.quantityOnHand),
    reorderPoint: Number(level.reorderPoint),
    updatedAt: level.updatedAt.toISOString(),
    item: item ? {
      ...item,
      unitPrice: Number(item.unitPrice),
      costPrice: Number(item.costPrice),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    } : undefined,
  };
}

router.get("/inventory", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(inventoryLevelsTable)
    .innerJoin(itemsTable, eq(inventoryLevelsTable.itemId, itemsTable.id))
    .orderBy(itemsTable.name);

  res.json(ListInventoryResponse.parse(rows.map(r => fmtLevel(r.inventory_levels, r.items))));
});

router.get("/inventory/low-stock", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(inventoryLevelsTable)
    .innerJoin(itemsTable, eq(inventoryLevelsTable.itemId, itemsTable.id))
    .where(lte(inventoryLevelsTable.quantityOnHand, inventoryLevelsTable.reorderPoint))
    .orderBy(itemsTable.name);

  res.json(ListLowStockResponse.parse(rows.map(r => fmtLevel(r.inventory_levels, r.items))));
});

router.get("/inventory/:itemId", async (req, res): Promise<void> => {
  const params = GetInventoryLevelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rows = await db
    .select()
    .from(inventoryLevelsTable)
    .innerJoin(itemsTable, eq(inventoryLevelsTable.itemId, itemsTable.id))
    .where(eq(inventoryLevelsTable.itemId, params.data.itemId));

  if (!rows.length) {
    res.status(404).json({ error: "Inventory level not found" });
    return;
  }

  res.json(GetInventoryLevelResponse.parse(fmtLevel(rows[0].inventory_levels, rows[0].items)));
});

router.patch("/inventory/:itemId", async (req, res): Promise<void> => {
  const params = UpdateInventoryLevelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateInventoryLevelBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.quantityOnHand !== undefined) updateData.quantityOnHand = String(parsed.data.quantityOnHand);
  if (parsed.data.reorderPoint !== undefined) updateData.reorderPoint = String(parsed.data.reorderPoint);

  const [level] = await db
    .update(inventoryLevelsTable)
    .set(updateData)
    .where(eq(inventoryLevelsTable.itemId, params.data.itemId))
    .returning();

  if (!level) {
    res.status(404).json({ error: "Inventory level not found" });
    return;
  }

  const rows = await db
    .select()
    .from(inventoryLevelsTable)
    .innerJoin(itemsTable, eq(inventoryLevelsTable.itemId, itemsTable.id))
    .where(eq(inventoryLevelsTable.itemId, params.data.itemId));

  res.json(UpdateInventoryLevelResponse.parse(fmtLevel(rows[0].inventory_levels, rows[0].items)));
});

router.post("/inventory/:itemId/adjust", async (req, res): Promise<void> => {
  const params = AdjustStockParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AdjustStockBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Record adjustment
  const [adj] = await db.insert(stockAdjustmentsTable).values({
    itemId: params.data.itemId,
    quantity: String(parsed.data.quantity),
    reason: parsed.data.reason,
    notes: parsed.data.notes ?? null,
  }).returning();

  // Update inventory level
  const currentRows = await db
    .select()
    .from(inventoryLevelsTable)
    .where(eq(inventoryLevelsTable.itemId, params.data.itemId));

  if (currentRows.length > 0) {
    const current = Number(currentRows[0].quantityOnHand);
    const newQty = current + parsed.data.quantity;
    await db
      .update(inventoryLevelsTable)
      .set({ quantityOnHand: String(newQty) })
      .where(eq(inventoryLevelsTable.itemId, params.data.itemId));
  } else {
    await db.insert(inventoryLevelsTable).values({
      itemId: params.data.itemId,
      quantityOnHand: String(parsed.data.quantity),
      reorderPoint: "0",
    });
  }

  res.status(201).json({
    id: adj.id,
    itemId: adj.itemId,
    quantity: Number(adj.quantity),
    reason: adj.reason,
    notes: adj.notes,
    createdAt: adj.createdAt.toISOString(),
  });
});

router.get("/inventory/:itemId/adjustments", async (req, res): Promise<void> => {
  const params = ListStockAdjustmentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const adjustments = await db
    .select()
    .from(stockAdjustmentsTable)
    .where(eq(stockAdjustmentsTable.itemId, params.data.itemId))
    .orderBy(stockAdjustmentsTable.createdAt);

  res.json(ListStockAdjustmentsResponse.parse(adjustments.map(a => ({
    ...a,
    quantity: Number(a.quantity),
    createdAt: a.createdAt.toISOString(),
  }))));
});

export default router;
