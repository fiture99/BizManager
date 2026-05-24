import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";
import LoginPage from "@/pages/login";
import { AuthProvider, useAuth } from "@/lib/auth-context";

import Dashboard from "@/pages/dashboard";
import POS from "@/pages/pos";
import Items from "@/pages/items";
import Inventory from "@/pages/inventory";
import Invoices from "@/pages/invoices";
import PurchaseOrders from "@/pages/purchase-orders";
import Customers from "@/pages/customers";
import Suppliers from "@/pages/suppliers";
import Reports from "@/pages/reports";
import UsersPage from "@/pages/users";

const queryClient = new QueryClient();

function ApproverlOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role === "inputter") return <Redirect to="/" />;
  return <>{children}</>;
}

function Router() {
  const { user } = useAuth();

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/pos" component={POS} />
        <Route path="/items" component={Items} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/customers" component={Customers} />
        <Route path="/suppliers" component={Suppliers} />
        <Route path="/invoices">
          <ApproverlOnly><Invoices /></ApproverlOnly>
        </Route>
        <Route path="/purchase-orders">
          <ApproverlOnly><PurchaseOrders /></ApproverlOnly>
        </Route>
        <Route path="/reports">
          <ApproverlOnly><Reports /></ApproverlOnly>
        </Route>
        <Route path="/users" component={UsersPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
