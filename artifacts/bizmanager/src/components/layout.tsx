import React, { useState } from "react";
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
  X,
  LogOut,
  UserCog,
  ChevronDown,
  Menu,
} from "lucide-react";
import { useListLowStock, useListItems } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const allNavigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, roles: ["inputter", "approver", "admin"] },
  { name: "Point of Sale", href: "/pos", icon: Store, roles: ["inputter", "approver", "admin"] },
  { name: "Items", href: "/items", icon: Package, roles: ["inputter", "approver", "admin"] },
  { name: "Inventory", href: "/inventory", icon: Boxes, roles: ["inputter", "approver", "admin"] },
  { name: "Customers", href: "/customers", icon: Users, roles: ["inputter", "approver", "admin"] },
  { name: "Suppliers", href: "/suppliers", icon: Truck, roles: ["inputter", "approver", "admin"] },
  { name: "Invoices", href: "/invoices", icon: FileText, roles: ["approver", "admin"] },
  { name: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart, roles: ["approver", "admin"] },
  { name: "Reports", href: "/reports", icon: BarChart2, roles: ["approver", "admin"] },
  { name: "Users", href: "/users", icon: UserCog, roles: ["admin"] },
];

const roleBadgeColors: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  approver: "bg-blue-100 text-blue-700",
  inputter: "bg-green-100 text-green-700",
};

function GlobalAlertsBar() {
  const [dismissed, setDismissed] = useState(false);
  const { data: lowStockItems } = useListLowStock();
  const { data: allItems } = useListItems();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7Days = new Date(today);
  in7Days.setDate(today.getDate() + 7);

  const expiringItems = (allItems ?? []).filter((item) => {
    if (!item.expiryDate) return false;
    const exp = new Date(item.expiryDate);
    return exp >= today && exp <= in7Days;
  });

  const expiredItems = (allItems ?? []).filter((item) => {
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

  const hasRed = alerts.some((a) => a.color === "red");

  return (
    <div className={`flex items-center gap-3 px-4 py-2 text-sm font-medium border-b ${hasRed ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <div className="flex-1 flex flex-wrap gap-x-4 gap-y-0.5">
        {alerts.map((a, i) => (
          <span key={i} className={a.color === "red" ? "text-red-700" : "text-amber-700"}>{a.text}</span>
        ))}
        <span className="text-muted-foreground font-normal">
          — go to{" "}
          <Link href="/inventory" className="underline underline-offset-2">Inventory</Link>{" "}
          or{" "}
          <Link href="/items" className="underline underline-offset-2">Items</Link>{" "}
          to review
        </span>
      </div>
      <button onClick={() => setDismissed(true)} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navigation = allNavigation.filter(
    (item) => user && item.roles.includes(user.role)
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center h-16 flex-shrink-0 px-6 bg-sidebar border-b border-sidebar-border md:border-b-0">
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
              <Link
                key={item.name}
                href={item.href}
                onClick={onNavigate}
                className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className={`mr-3 flex-shrink-0 h-5 w-5 ${isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {user && (
        <div className="border-t border-sidebar-border px-3 py-3">
          <button
            onClick={() => setShowUserMenu((v) => !v)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs flex-shrink-0">
              {user.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="truncate font-medium">{user.username}</div>
              <div className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${roleBadgeColors[user.role] ?? "bg-gray-100 text-gray-700"}`}>
                {user.role}
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform ${showUserMenu ? "rotate-180" : ""}`} />
          </button>
          {showUserMenu && (
            <div className="mt-1 px-3">
              <button
                onClick={() => { logout(); onNavigate?.(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-sidebar border-r border-sidebar-border">
        <NavItems />
      </div>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 h-14 px-4 bg-sidebar border-b border-sidebar-border">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button className="text-sidebar-foreground p-1 rounded-md hover:bg-sidebar-accent/50 transition-colors">
              <Menu className="h-6 w-6" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 bg-sidebar border-sidebar-border">
            <NavItems onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="text-lg font-bold text-sidebar-foreground flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center text-primary-foreground">
            <Boxes className="w-4 h-4" />
          </div>
          BizManager
        </span>
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 w-0 md:pl-64 pt-14 md:pt-0">
        <GlobalAlertsBar />
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
