import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, purchaseOrdersTable, purchaseOrderLineItemsTable, suppliersTable, itemsTable, inventoryLevelsTable, stockAdjustmentsTable } from "@workspace/db";
import {
  CreatePurchaseOrderBody,
  GetPurchaseOrderParams,
  GetPurchaseOrderResponse,
  UpdatePurchaseOrderParams,
  UpdatePurchaseOrderBody,
  UpdatePurchaseOrderResponse,
  DeletePurchaseOrderParams,
  UpdatePurchaseOrderStatusParams,
  UpdatePurchaseOrderStatusBody,
  UpdatePurchaseOrderStatusResponse,
  ListPurchaseOrdersResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getPOWithRelations(id: number) {
  const rows = await db
    .select()
    .from(purchaseOrdersTable)
    .innerJoin(suppliersTable, eq(purchaseOrdersTable.supplierId, suppliersTable.id))
    .where(eq(purchaseOrdersTable.id, id));

  if (!rows.length) return null;

  const row = rows[0];
  const lineItems = await db
    .select()
    .from(purchaseOrderLineItemsTable)
    .leftJoin(itemsTable, eq(purchaseOrderLineItemsTable.itemId, itemsTable.id))
    .where(eq(purchaseOrderLineItemsTable.purchaseOrderId, id));

  return {
    id: row.purchase_orders.id,
    poNumber: row.purchase_orders.poNumber,
    supplierId: row.purchase_orders.supplierId,
    status: row.purchase_orders.status,
    orderDate: row.purchase_orders.orderDate?.toISOString() ?? null,
    expectedDate: row.purchase_orders.expectedDate?.toISOString() ?? null,
    subtotal: Number(row.purchase_orders.subtotal),
    total: Number(row.purchase_orders.total),
    notes: row.purchase_orders.notes,
    createdAt: row.purchase_orders.createdAt.toISOString(),
    supplier: {
      ...row.suppliers,
      createdAt: row.suppliers.createdAt.toISOString(),
    },
    lineItems: lineItems.map(li => ({
      id: li.purchase_order_line_items.id,
      purchaseOrderId: li.purchase_order_line_items.purchaseOrderId,
      itemId: li.purchase_order_line_items.itemId,
      description: li.purchase_order_line_items.description,
      quantity: Number(li.purchase_order_line_items.quantity),
      unitCost: Number(li.purchase_order_line_items.unitCost),
      lineTotal: Number(li.purchase_order_line_items.lineTotal),
      item: li.items ? {
        ...li.items,
        unitPrice: Number(li.items.unitPrice),
        costPrice: Number(li.items.costPrice),
        createdAt: li.items.createdAt.toISOString(),
        updatedAt: li.items.updatedAt.toISOString(),
      } : undefined,
    })),
  };
}

function generatePONumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `PO-${year}${month}-${rand}`;
}

router.get("/purchase-orders", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(purchaseOrdersTable)
    .innerJoin(suppliersTable, eq(purchaseOrdersTable.supplierId, suppliersTable.id))
    .orderBy(purchaseOrdersTable.createdAt);

  const withItems = await Promise.all(rows.map(r => getPOWithRelations(r.purchase_orders.id)));
  res.json(ListPurchaseOrdersResponse.parse(withItems.filter(Boolean)));
});

router.post("/purchase-orders", async (req, res): Promise<void> => {
  const parsed = CreatePurchaseOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { supplierId, orderDate, expectedDate, notes, lineItems } = parsed.data;
  const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unitCost, 0);

  const [po] = await db.insert(purchaseOrdersTable).values({
    poNumber: generatePONumber(),
    supplierId,
    status: "Draft",
    orderDate: orderDate ? new Date(orderDate) : null,
    expectedDate: expectedDate ? new Date(expectedDate) : null,
    subtotal: String(subtotal),
    total: String(subtotal),
    notes: notes ?? null,
  }).returning();

  await Promise.all(lineItems.map(li =>
    db.insert(purchaseOrderLineItemsTable).values({
      purchaseOrderId: po.id,
      itemId: li.itemId ?? null,
      description: li.description,
      quantity: String(li.quantity),
      unitCost: String(li.unitCost),
      lineTotal: String(li.quantity * li.unitCost),
    })
  ));

  const result = await getPOWithRelations(po.id);
  res.status(201).json(GetPurchaseOrderResponse.parse(result));
});

router.get("/purchase-orders/:id", async (req, res): Promise<void> => {
  const params = GetPurchaseOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const result = await getPOWithRelations(params.data.id);
  if (!result) {
    res.status(404).json({ error: "Purchase order not found" });
    return;
  }

  res.json(GetPurchaseOrderResponse.parse(result));
});

router.patch("/purchase-orders/:id", async (req, res): Promise<void> => {
  const params = UpdatePurchaseOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePurchaseOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { supplierId, orderDate, expectedDate, notes, lineItems } = parsed.data;

  const updateData: Record<string, unknown> = {};
  if (supplierId !== undefined) updateData.supplierId = supplierId;
  if (orderDate !== undefined) updateData.orderDate = new Date(orderDate);
  if (expectedDate !== undefined) updateData.expectedDate = new Date(expectedDate);
  if (notes !== undefined) updateData.notes = notes;

  if (lineItems !== undefined) {
    const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unitCost, 0);
    updateData.subtotal = String(subtotal);
    updateData.total = String(subtotal);
  }

  if (Object.keys(updateData).length > 0) {
    await db.update(purchaseOrdersTable).set(updateData).where(eq(purchaseOrdersTable.id, params.data.id));
  }

  if (lineItems !== undefined) {
    await db.delete(purchaseOrderLineItemsTable).where(eq(purchaseOrderLineItemsTable.purchaseOrderId, params.data.id));
    await Promise.all(lineItems.map(li =>
      db.insert(purchaseOrderLineItemsTable).values({
        purchaseOrderId: params.data.id,
        itemId: li.itemId ?? null,
        description: li.description,
        quantity: String(li.quantity),
        unitCost: String(li.unitCost),
        lineTotal: String(li.quantity * li.unitCost),
      })
    ));
  }

  const result = await getPOWithRelations(params.data.id);
  if (!result) {
    res.status(404).json({ error: "Purchase order not found" });
    return;
  }

  res.json(UpdatePurchaseOrderResponse.parse(result));
});

router.delete("/purchase-orders/:id", async (req, res): Promise<void> => {
  const params = DeletePurchaseOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [po] = await db.delete(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, params.data.id)).returning();
  if (!po) {
    res.status(404).json({ error: "Purchase order not found" });
    return;
  }

  res.sendStatus(204);
});

router.patch("/purchase-orders/:id/status", async (req, res): Promise<void> => {
  const params = UpdatePurchaseOrderStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePurchaseOrderStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const prevRows = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, params.data.id));
  if (!prevRows.length) {
    res.status(404).json({ error: "Purchase order not found" });
    return;
  }

  await db.update(purchaseOrdersTable)
    .set({ status: parsed.data.status })
    .where(eq(purchaseOrdersTable.id, params.data.id));

  // If transitioning to Received, update inventory
  if (parsed.data.status === "Received" && prevRows[0].status !== "Received") {
    const lineItems = await db
      .select()
      .from(purchaseOrderLineItemsTable)
      .where(eq(purchaseOrderLineItemsTable.purchaseOrderId, params.data.id));

    for (const li of lineItems) {
      if (!li.itemId) continue;

      const qty = Number(li.quantity);

      // Record stock adjustment
      await db.insert(stockAdjustmentsTable).values({
        itemId: li.itemId,
        quantity: String(qty),
        reason: `PO Received: ${prevRows[0].poNumber}`,
        notes: null,
      });

      // Upsert inventory level
      const existing = await db
        .select()
        .from(inventoryLevelsTable)
        .where(eq(inventoryLevelsTable.itemId, li.itemId));

      if (existing.length > 0) {
        const newQty = Number(existing[0].quantityOnHand) + qty;
        await db
          .update(inventoryLevelsTable)
          .set({ quantityOnHand: String(newQty) })
          .where(eq(inventoryLevelsTable.itemId, li.itemId));
      } else {
        await db.insert(inventoryLevelsTable).values({
          itemId: li.itemId,
          quantityOnHand: String(qty),
          reorderPoint: "0",
        });
      }
    }
  }

  const result = await getPOWithRelations(params.data.id);
  res.json(UpdatePurchaseOrderStatusResponse.parse(result));
});

export default router;
