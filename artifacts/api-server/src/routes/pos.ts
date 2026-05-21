import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, salesTable, saleLineItemsTable, itemsTable, inventoryLevelsTable, stockAdjustmentsTable } from "@workspace/db";
import {
  CreateSaleBody,
  GetSaleParams,
  GetSaleResponse,
  ListSalesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getSaleWithRelations(id: number) {
  const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, id));
  if (!sale) return null;

  const lineItemRows = await db
    .select()
    .from(saleLineItemsTable)
    .leftJoin(itemsTable, eq(saleLineItemsTable.itemId, itemsTable.id))
    .where(eq(saleLineItemsTable.saleId, id));

  const lineItems = lineItemRows.map(row => ({
    ...row.sale_line_items,
    quantity: Number(row.sale_line_items.quantity),
    unitPrice: Number(row.sale_line_items.unitPrice),
    lineTotal: Number(row.sale_line_items.lineTotal),
    item: row.items ? {
      ...row.items,
      unitPrice: Number(row.items.unitPrice),
      costPrice: Number(row.items.costPrice),
      createdAt: row.items.createdAt.toISOString(),
      updatedAt: row.items.updatedAt.toISOString(),
    } : undefined,
  }));

  return {
    ...sale,
    subtotal: Number(sale.subtotal),
    taxRate: Number(sale.taxRate),
    taxAmount: Number(sale.taxAmount),
    total: Number(sale.total),
    amountTendered: sale.amountTendered != null ? Number(sale.amountTendered) : null,
    change: sale.change != null ? Number(sale.change) : null,
    createdAt: sale.createdAt.toISOString(),
    lineItems,
  };
}

router.get("/pos/sales", async (req, res): Promise<void> => {
  const sales = await db.select().from(salesTable).orderBy(salesTable.createdAt);

  const result = await Promise.all(sales.map(s => getSaleWithRelations(s.id)));
  res.json(ListSalesResponse.parse(result.filter(Boolean)));
});

router.get("/pos/sales/:id", async (req, res): Promise<void> => {
  const params = GetSaleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const sale = await getSaleWithRelations(params.data.id);
  if (!sale) {
    res.status(404).json({ error: "Sale not found" });
    return;
  }

  res.json(GetSaleResponse.parse(sale));
});

router.post("/pos/sales", async (req, res): Promise<void> => {
  const parsed = CreateSaleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { paymentMethod, taxRate = 0, amountTendered, notes, lineItems } = parsed.data;

  // Calculate totals
  const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  const change = amountTendered != null ? amountTendered - total : null;

  // Generate sale number
  const saleCount = await db.$count(salesTable);
  const saleNumber = `SALE-${String(saleCount + 1).padStart(5, "0")}`;

  const [sale] = await db.insert(salesTable).values({
    saleNumber,
    paymentMethod,
    subtotal: String(subtotal),
    taxRate: String(taxRate),
    taxAmount: String(taxAmount),
    total: String(total),
    amountTendered: amountTendered != null ? String(amountTendered) : null,
    change: change != null ? String(change) : null,
    notes: notes ?? null,
  }).returning();

  // Insert line items
  for (const li of lineItems) {
    const lineTotal = li.quantity * li.unitPrice;
    await db.insert(saleLineItemsTable).values({
      saleId: sale.id,
      itemId: li.itemId ?? null,
      description: li.description,
      quantity: String(li.quantity),
      unitPrice: String(li.unitPrice),
      lineTotal: String(lineTotal),
    });

    // Deduct from inventory if itemId provided
    if (li.itemId) {
      const [level] = await db.select().from(inventoryLevelsTable).where(eq(inventoryLevelsTable.itemId, li.itemId));
      if (level) {
        const newQty = Math.max(0, Number(level.quantityOnHand) - li.quantity);
        await db.update(inventoryLevelsTable)
          .set({ quantityOnHand: String(newQty) })
          .where(eq(inventoryLevelsTable.itemId, li.itemId));

        await db.insert(stockAdjustmentsTable).values({
          itemId: li.itemId,
          quantity: String(-li.quantity),
          reason: "POS Sale",
          notes: `Sale ${saleNumber}`,
        });
      }
    }
  }

  const result = await getSaleWithRelations(sale.id);
  res.status(201).json(GetSaleResponse.parse(result));
});

export default router;
