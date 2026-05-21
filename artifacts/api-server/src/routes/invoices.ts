import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, invoicesTable, invoiceLineItemsTable, customersTable, itemsTable } from "@workspace/db";
import {
  CreateInvoiceBody,
  GetInvoiceParams,
  GetInvoiceResponse,
  UpdateInvoiceParams,
  UpdateInvoiceBody,
  UpdateInvoiceResponse,
  DeleteInvoiceParams,
  UpdateInvoiceStatusParams,
  UpdateInvoiceStatusBody,
  UpdateInvoiceStatusResponse,
  ListInvoicesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getInvoiceWithRelations(id: number) {
  const rows = await db
    .select()
    .from(invoicesTable)
    .innerJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .where(eq(invoicesTable.id, id));

  if (!rows.length) return null;

  const row = rows[0];
  const lineItems = await db
    .select()
    .from(invoiceLineItemsTable)
    .leftJoin(itemsTable, eq(invoiceLineItemsTable.itemId, itemsTable.id))
    .where(eq(invoiceLineItemsTable.invoiceId, id));

  return {
    id: row.invoices.id,
    invoiceNumber: row.invoices.invoiceNumber,
    customerId: row.invoices.customerId,
    status: row.invoices.status,
    issueDate: row.invoices.issueDate?.toISOString() ?? null,
    dueDate: row.invoices.dueDate?.toISOString() ?? null,
    subtotal: Number(row.invoices.subtotal),
    taxRate: Number(row.invoices.taxRate),
    taxAmount: Number(row.invoices.taxAmount),
    total: Number(row.invoices.total),
    notes: row.invoices.notes,
    createdAt: row.invoices.createdAt.toISOString(),
    customer: {
      ...row.customers,
      createdAt: row.customers.createdAt.toISOString(),
    },
    lineItems: lineItems.map(li => ({
      id: li.invoice_line_items.id,
      invoiceId: li.invoice_line_items.invoiceId,
      itemId: li.invoice_line_items.itemId,
      description: li.invoice_line_items.description,
      quantity: Number(li.invoice_line_items.quantity),
      unitPrice: Number(li.invoice_line_items.unitPrice),
      lineTotal: Number(li.invoice_line_items.lineTotal),
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

function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `INV-${year}${month}-${rand}`;
}

router.get("/invoices", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(invoicesTable)
    .innerJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .orderBy(invoicesTable.createdAt);

  const withItems = await Promise.all(rows.map(r => getInvoiceWithRelations(r.invoices.id)));
  res.json(ListInvoicesResponse.parse(withItems.filter(Boolean)));
});

router.post("/invoices", async (req, res): Promise<void> => {
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { customerId, issueDate, dueDate, taxRate = 0, notes, lineItems } = parsed.data;

  const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const [invoice] = await db.insert(invoicesTable).values({
    invoiceNumber: generateInvoiceNumber(),
    customerId,
    status: "Draft",
    issueDate: issueDate ? new Date(issueDate) : null,
    dueDate: dueDate ? new Date(dueDate) : null,
    subtotal: String(subtotal),
    taxRate: String(taxRate),
    taxAmount: String(taxAmount),
    total: String(total),
    notes: notes ?? null,
  }).returning();

  await Promise.all(lineItems.map(li =>
    db.insert(invoiceLineItemsTable).values({
      invoiceId: invoice.id,
      itemId: li.itemId ?? null,
      description: li.description,
      quantity: String(li.quantity),
      unitPrice: String(li.unitPrice),
      lineTotal: String(li.quantity * li.unitPrice),
    })
  ));

  const result = await getInvoiceWithRelations(invoice.id);
  res.status(201).json(GetInvoiceResponse.parse(result));
});

router.get("/invoices/:id", async (req, res): Promise<void> => {
  const params = GetInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const result = await getInvoiceWithRelations(params.data.id);
  if (!result) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  res.json(GetInvoiceResponse.parse(result));
});

router.patch("/invoices/:id", async (req, res): Promise<void> => {
  const params = UpdateInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { customerId, issueDate, dueDate, taxRate, notes, lineItems } = parsed.data;

  // Recompute totals if lineItems provided
  let updateData: Record<string, unknown> = {};
  if (customerId !== undefined) updateData.customerId = customerId;
  if (issueDate !== undefined) updateData.issueDate = new Date(issueDate);
  if (dueDate !== undefined) updateData.dueDate = new Date(dueDate);
  if (notes !== undefined) updateData.notes = notes;

  if (lineItems !== undefined) {
    const rate = taxRate ?? 0;
    const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
    const taxAmount = subtotal * (rate / 100);
    updateData.subtotal = String(subtotal);
    updateData.taxRate = String(rate);
    updateData.taxAmount = String(taxAmount);
    updateData.total = String(subtotal + taxAmount);
  } else if (taxRate !== undefined) {
    const existing = await db.select().from(invoicesTable).where(eq(invoicesTable.id, params.data.id));
    if (existing.length > 0) {
      const subtotal = Number(existing[0].subtotal);
      const taxAmount = subtotal * (taxRate / 100);
      updateData.taxRate = String(taxRate);
      updateData.taxAmount = String(taxAmount);
      updateData.total = String(subtotal + taxAmount);
    }
  }

  if (Object.keys(updateData).length > 0) {
    await db.update(invoicesTable).set(updateData).where(eq(invoicesTable.id, params.data.id));
  }

  if (lineItems !== undefined) {
    await db.delete(invoiceLineItemsTable).where(eq(invoiceLineItemsTable.invoiceId, params.data.id));
    await Promise.all(lineItems.map(li =>
      db.insert(invoiceLineItemsTable).values({
        invoiceId: params.data.id,
        itemId: li.itemId ?? null,
        description: li.description,
        quantity: String(li.quantity),
        unitPrice: String(li.unitPrice),
        lineTotal: String(li.quantity * li.unitPrice),
      })
    ));
  }

  const result = await getInvoiceWithRelations(params.data.id);
  if (!result) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  res.json(UpdateInvoiceResponse.parse(result));
});

router.delete("/invoices/:id", async (req, res): Promise<void> => {
  const params = DeleteInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [inv] = await db.delete(invoicesTable).where(eq(invoicesTable.id, params.data.id)).returning();
  if (!inv) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  res.sendStatus(204);
});

router.patch("/invoices/:id/status", async (req, res): Promise<void> => {
  const params = UpdateInvoiceStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateInvoiceStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await db.update(invoicesTable).set({ status: parsed.data.status }).where(eq(invoicesTable.id, params.data.id));

  const result = await getInvoiceWithRelations(params.data.id);
  if (!result) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  res.json(UpdateInvoiceStatusResponse.parse(result));
});

export default router;
