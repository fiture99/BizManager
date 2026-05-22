import { Router, type IRouter } from "express";
import { gte, lte, and, eq } from "drizzle-orm";
import { db, salesTable, saleLineItemsTable, itemsTable } from "@workspace/db";

const router: IRouter = Router();

function getDateRange(period: string, from?: string, to?: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (period === "custom" && from && to) {
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    const customEnd = new Date(to);
    customEnd.setHours(23, 59, 59, 999);
    return { start, end: customEnd };
  }

  if (period === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  if (period === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  // month (default)
  const start = new Date(now);
  start.setDate(now.getDate() - 29);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

router.get("/reports/sales", async (req, res): Promise<void> => {
  const period = (req.query["period"] as string) || "month";
  const from = req.query["from"] as string | undefined;
  const to = req.query["to"] as string | undefined;

  const { start, end } = getDateRange(period, from, to);

  const sales = await db
    .select()
    .from(salesTable)
    .where(and(gte(salesTable.createdAt, start), lte(salesTable.createdAt, end)));

  const lineItemRows = await db
    .select()
    .from(saleLineItemsTable)
    .leftJoin(itemsTable, eq(itemsTable.id, saleLineItemsTable.itemId));

  // Build a set of sale IDs in the range
  const saleIds = new Set(sales.map(s => s.id));
  const relevantLineItems = lineItemRows.filter(r => saleIds.has(r.sale_line_items.saleId));

  // Summary stats
  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total), 0);
  const totalTransactions = sales.length;
  const avgOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
  const totalTax = sales.reduce((sum, s) => sum + Number(s.taxAmount), 0);

  // Daily revenue — group by date string
  const dailyMap = new Map<string, { revenue: number; transactions: number }>();

  // Pre-fill each day in the range
  const cursor = new Date(start);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    dailyMap.set(key, { revenue: 0, transactions: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const s of sales) {
    const key = s.createdAt.toISOString().slice(0, 10);
    const existing = dailyMap.get(key) ?? { revenue: 0, transactions: 0 };
    existing.revenue += Number(s.total);
    existing.transactions += 1;
    dailyMap.set(key, existing);
  }

  const dailyRevenue = Array.from(dailyMap.entries()).map(([date, data]) => ({
    date,
    revenue: Math.round(data.revenue * 100) / 100,
    transactions: data.transactions,
  }));

  // Top items by quantity sold
  const itemTotals = new Map<number, { name: string; quantitySold: number; revenue: number }>();
  for (const row of relevantLineItems) {
    const li = row.sale_line_items;
    if (!li.itemId) continue;
    const name = row.items?.name ?? li.description;
    const existing = itemTotals.get(li.itemId) ?? { name, quantitySold: 0, revenue: 0 };
    existing.quantitySold += Number(li.quantity);
    existing.revenue += Number(li.lineTotal);
    itemTotals.set(li.itemId, existing);
  }

  const topItems = Array.from(itemTotals.entries())
    .map(([itemId, data]) => ({
      itemId,
      name: data.name,
      quantitySold: Math.round(data.quantitySold * 100) / 100,
      revenue: Math.round(data.revenue * 100) / 100,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Payment method breakdown
  const paymentMap = new Map<string, { count: number; total: number }>();
  for (const s of sales) {
    const method = s.paymentMethod;
    const existing = paymentMap.get(method) ?? { count: 0, total: 0 };
    existing.count += 1;
    existing.total += Number(s.total);
    paymentMap.set(method, existing);
  }

  const paymentBreakdown = Array.from(paymentMap.entries()).map(([method, data]) => ({
    method,
    count: data.count,
    total: Math.round(data.total * 100) / 100,
  }));

  res.json({
    summary: {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalTransactions,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
    },
    dailyRevenue,
    topItems,
    paymentBreakdown,
  });
});

export default router;
