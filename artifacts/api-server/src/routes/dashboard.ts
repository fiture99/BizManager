import { Router, type IRouter } from "express";
import { eq, and, gte, lt, inArray } from "drizzle-orm";
import { db, itemsTable, inventoryLevelsTable, customersTable, suppliersTable, invoicesTable, purchaseOrdersTable, invoiceLineItemsTable, stockAdjustmentsTable } from "@workspace/db";
import { GetDashboardSummaryResponse, GetRecentActivityResponse, GetInvoiceStatsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [items, inventory, customers, suppliers, invoices, purchaseOrders] = await Promise.all([
    db.select().from(itemsTable),
    db.select().from(inventoryLevelsTable),
    db.select().from(customersTable),
    db.select().from(suppliersTable),
    db.select().from(invoicesTable),
    db.select().from(purchaseOrdersTable),
  ]);

  // Inventory valuation: sum(quantityOnHand * item.costPrice)
  const itemMap = new Map(items.map(i => [i.id, i]));
  const totalInventoryValue = inventory.reduce((sum, inv) => {
    const item = itemMap.get(inv.itemId);
    if (!item) return sum;
    return sum + Number(inv.quantityOnHand) * Number(item.costPrice);
  }, 0);

  // Low stock: items where qty <= reorderPoint
  const lowStockCount = inventory.filter(inv => Number(inv.quantityOnHand) <= Number(inv.reorderPoint)).length;

  // Outstanding invoices (Sent + Overdue)
  const outstanding = invoices.filter(inv => inv.status === "Sent" || inv.status === "Overdue");
  const outstandingInvoicesTotal = outstanding.reduce((sum, inv) => sum + Number(inv.total), 0);

  // Paid this month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const paidThisMonth = invoices.filter(inv =>
    inv.status === "Paid" && inv.createdAt >= startOfMonth
  );
  const paidInvoicesThisMonth = paidThisMonth.reduce((sum, inv) => sum + Number(inv.total), 0);

  // Pending POs
  const pendingPurchaseOrders = purchaseOrders.filter(po => po.status === "Draft" || po.status === "Sent").length;

  res.json(GetDashboardSummaryResponse.parse({
    totalInventoryValue,
    outstandingInvoicesTotal,
    outstandingInvoicesCount: outstanding.length,
    lowStockCount,
    totalCustomers: customers.length,
    totalSuppliers: suppliers.length,
    totalItems: items.length,
    paidInvoicesThisMonth,
    pendingPurchaseOrders,
  }));
});

router.get("/dashboard/recent-activity", async (_req, res): Promise<void> => {
  const [invoices, purchaseOrders, adjustments] = await Promise.all([
    db.select().from(invoicesTable).orderBy(invoicesTable.createdAt).limit(5),
    db.select().from(purchaseOrdersTable).orderBy(purchaseOrdersTable.createdAt).limit(5),
    db.select().from(stockAdjustmentsTable).orderBy(stockAdjustmentsTable.createdAt).limit(5),
  ]);

  const activity = [
    ...invoices.map(inv => ({
      id: `invoice-${inv.id}`,
      type: "invoice" as const,
      description: `Invoice ${inv.invoiceNumber}`,
      amount: Number(inv.total),
      status: inv.status,
      createdAt: inv.createdAt.toISOString(),
    })),
    ...purchaseOrders.map(po => ({
      id: `po-${po.id}`,
      type: "purchase_order" as const,
      description: `PO ${po.poNumber}`,
      amount: Number(po.total),
      status: po.status,
      createdAt: po.createdAt.toISOString(),
    })),
    ...adjustments.map(adj => ({
      id: `adj-${adj.id}`,
      type: "stock_adjustment" as const,
      description: `Stock adjustment: ${adj.reason}`,
      amount: Number(adj.quantity),
      status: null,
      createdAt: adj.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);

  res.json(GetRecentActivityResponse.parse(activity));
});

router.get("/dashboard/invoice-stats", async (_req, res): Promise<void> => {
  const invoices = await db.select().from(invoicesTable);

  const stats = {
    draft: 0, sent: 0, paid: 0, overdue: 0,
    totalDraft: 0, totalSent: 0, totalPaid: 0, totalOverdue: 0,
  };

  for (const inv of invoices) {
    const total = Number(inv.total);
    switch (inv.status) {
      case "Draft":   stats.draft++;   stats.totalDraft += total;   break;
      case "Sent":    stats.sent++;    stats.totalSent += total;    break;
      case "Paid":    stats.paid++;    stats.totalPaid += total;    break;
      case "Overdue": stats.overdue++; stats.totalOverdue += total; break;
    }
  }

  res.json(GetInvoiceStatsResponse.parse(stats));
});

export default router;
