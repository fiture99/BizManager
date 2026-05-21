import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";

// Pages
import Dashboard from "@/pages/dashboard";
import POS from "@/pages/pos";
import Items from "@/pages/items";
import Inventory from "@/pages/inventory";
import Invoices from "@/pages/invoices";
import PurchaseOrders from "@/pages/purchase-orders";
import Customers from "@/pages/customers";
import Suppliers from "@/pages/suppliers";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/pos" component={POS} />
        <Route path="/items" component={Items} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/invoices" component={Invoices} />
        <Route path="/purchase-orders" component={PurchaseOrders} />
        <Route path="/customers" component={Customers} />
        <Route path="/suppliers" component={Suppliers} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
