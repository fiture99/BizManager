import React from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Package, 
  Boxes, 
  FileText, 
  ShoppingCart, 
  Users, 
  Truck,
  Store,
  BarChart2,
  AlertTriangle,
  X
} from "lucide-react";
import { useListLowStock, useListItems } from "@workspace/api-client-react";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Point of Sale", href: "/pos", icon: Store },
  { name: "Items", href: "/items", icon: Package },
  { name: "Inventory", href: "/inventory", icon: Boxes },
  { name: "Invoices", href: "/invoices", icon: FileText },
  { name: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Suppliers", href: "/suppliers", icon: Truck },
  { name: "Reports", href: "/reports", icon: BarChart2 },
];

function GlobalAlertsBar() {
  const [dismissed, setDismissed] = useState(false);
  const { data: lowStockItems } = useListLowStock();
  const { data: allItems } = useListItems();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7Days = new Date(today);
  in7Days.setDate(today.getDate() + 7);

  const expiringItems = (allItems ?? []).filter(item => {
    if (!item.expiryDate) return false;
    const exp = new Date(item.expiryDate);
    return exp >= today && exp <= in7Days;
  });

  const expiredItems = (allItems ?? []).filter(item => {
    if (!item.expiryDate) return false;
    return new Date(item.expiryDate) < today;
  });

  const lowCount = (lowStockItems ?? []).length;
  const expiringCount = expiringItems.length;
  const expiredCount = expiredItems.length;

  if (dismissed || (lowCount === 0 && expiringCount === 0 && expiredCount === 0)) return null;

  const alerts: { text: string; color: "red" | "amber" }[] = [];
  if (lowCount > 0) alerts.push({ text: `${lowCount} item${lowCount > 1 ? "s" : ""} low on stock`, color: "red" });
  if (expiredCount > 0) alerts.push({ text: `${expiredCount} item${expiredCount > 1 ? "s" : ""} expired`, color: "red" });
  if (expiringCount > 0) alerts.push({ text: `${expiringCount} item${expiringCount > 1 ? "s" : ""} expiring within 7 days`, color: "amber" });

  const hasRed = alerts.some(a => a.color === "red");

  return (
    <div className={`flex items-center gap-3 px-4 py-2 text-sm font-medium border-b ${
      hasRed
        ? "bg-red-50 border-red-200 text-red-800"
        : "bg-amber-50 border-amber-200 text-amber-800"
    }`}>
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <div className="flex-1 flex flex-wrap gap-x-4 gap-y-0.5">
        {alerts.map((a, i) => (
          <span key={i} className={a.color === "red" ? "text-red-700" : "text-amber-700"}>
            {a.text}
          </span>
        ))}
        <span className="text-muted-foreground font-normal">
          — go to <Link href="/inventory" className="underline underline-offset-2">Inventory</Link> or <Link href="/items" className="underline underline-offset-2">Items</Link> to review
        </span>
      </div>
      <button onClick={() => setDismissed(true)} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-sidebar border-r border-sidebar-border">
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center h-16 flex-shrink-0 px-6 bg-sidebar">
            <span className="text-xl font-bold text-sidebar-foreground tracking-tight flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground">
                <Boxes className="w-5 h-5" />
              </div>
              BizManager
            </span>
          </div>
          <div className="flex-1 flex flex-col overflow-y-auto">
            <nav className="flex-1 px-3 py-4 space-y-1">
              {navigation.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link key={item.name} href={item.href} className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}>
                    <item.icon
                      className={`mr-3 flex-shrink-0 h-5 w-5 ${
                        isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70"
                      }`}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 w-0 md:pl-64">
        <GlobalAlertsBar />
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
