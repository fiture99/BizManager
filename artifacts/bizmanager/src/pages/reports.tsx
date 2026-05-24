import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, ShoppingBag, DollarSign, Receipt, Download, CalendarDays } from "lucide-react";
import { useGetSalesReport } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Period = "today" | "week" | "month";

const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  week: "Last 7 Days",
  month: "Last 30 Days",
};

const PAYMENT_COLORS: Record<string, string> = {
  Cash: "#6366f1",
  Card: "#22c55e",
  "Mobile Money": "#f59e0b",
};

const FALLBACK_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6"];

function fmt(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtShort(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Reports() {
  const [period, setPeriod] = useState<Period>("month");

  const { data, isLoading } = useGetSalesReport({ period });

  const summary = data?.summary;
  const dailyRevenue = data?.dailyRevenue ?? [];
  const topItems = data?.topItems ?? [];
  const paymentBreakdown = data?.paymentBreakdown ?? [];

  // Trim leading zero-revenue days for cleaner chart when period is month
  const chartData = useMemo(() => {
    if (period === "today") return dailyRevenue;
    const firstNonZero = dailyRevenue.findIndex(d => d.revenue > 0 || d.transactions > 0);
    return firstNonZero > 0 ? dailyRevenue.slice(firstNonZero) : dailyRevenue;
  }, [dailyRevenue, period]);

  function exportCSV() {
    if (!data) return;
    const rows = [
      ["Date", "Revenue", "Transactions"],
      ...dailyRevenue.map(d => [d.date, d.revenue.toFixed(2), String(d.transactions)]),
      [],
      ["Item", "Qty Sold", "Revenue"],
      ...topItems.map(i => [i.name, i.quantitySold.toFixed(2), i.revenue.toFixed(2)]),
      [],
      ["Payment Method", "Count", "Total"],
      ...paymentBreakdown.map(p => [p.method, String(p.count), p.total.toFixed(2)]),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-report-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sales Reports</h1>
          <p className="mt-1 text-muted-foreground">Revenue analytics and sales performance.</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={exportCSV} disabled={!data}>
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {/* Period selector */}
      <div className="flex gap-2 mb-8">
        {(["today", "week", "month"] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
              period === p
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold mt-1 text-foreground">
                  {isLoading ? "—" : fmt(summary?.totalRevenue ?? 0)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Transactions</p>
                <p className="text-2xl font-bold mt-1 text-foreground">
                  {isLoading ? "—" : (summary?.totalTransactions ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Order Value</p>
                <p className="text-2xl font-bold mt-1 text-foreground">
                  {isLoading ? "—" : fmt(summary?.avgOrderValue ?? 0)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tax Collected</p>
                <p className="text-2xl font-bold mt-1 text-foreground">
                  {isLoading ? "—" : fmt(summary?.totalTax ?? 0)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Daily Revenue chart — takes 2/3 */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Daily Revenue — {PERIOD_LABELS[period]}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
            ) : chartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">No sales in this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateLabel}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    interval={period === "month" ? 4 : 0}
                  />
                  <YAxis
                    tickFormatter={fmtShort}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                  <Tooltip
                    formatter={(val: number) => [fmt(val), "Revenue"]}
                    labelFormatter={(label) => formatDateLabel(label as string)}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Payment breakdown — takes 1/3 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
            ) : paymentBreakdown.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">No data</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={paymentBreakdown}
                      dataKey="total"
                      nameKey="method"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={40}
                      paddingAngle={3}
                    >
                      {paymentBreakdown.map((entry, index) => (
                        <Cell
                          key={entry.method}
                          fill={PAYMENT_COLORS[entry.method] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) => [fmt(val), "Revenue"]}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {paymentBreakdown.map((entry, index) => (
                    <div key={entry.method} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ background: PAYMENT_COLORS[entry.method] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length] }}
                        />
                        <span className="text-muted-foreground">{entry.method}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium">{fmt(entry.total)}</span>
                        <span className="text-muted-foreground ml-1">({entry.count})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Items table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Top Selling Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
          ) : topItems.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">No items sold in this period</div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-6 py-3 text-muted-foreground font-medium">#</th>
                  <th className="text-left px-6 py-3 text-muted-foreground font-medium">Item</th>
                  <th className="text-right px-6 py-3 text-muted-foreground font-medium">Qty Sold</th>
                  <th className="text-right px-6 py-3 text-muted-foreground font-medium">Revenue</th>
                  <th className="text-right px-6 py-3 text-muted-foreground font-medium">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {topItems.map((item, i) => {
                  const pct = summary && summary.totalRevenue > 0
                    ? (item.revenue / summary.totalRevenue) * 100
                    : 0;
                  return (
                    <tr key={item.itemId} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                      <td className="px-6 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-6 py-3 font-medium text-foreground">{item.name}</td>
                      <td className="px-6 py-3 text-right text-muted-foreground">{item.quantitySold}</td>
                      <td className="px-6 py-3 text-right font-semibold text-foreground">{fmt(item.revenue)}</td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <span className="text-muted-foreground w-10 text-right">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
