import { useState, useRef } from "react";
import {
  useListItems,
  useCreateSale,
  useListSales,
  getListSalesQueryKey,
  type Item,
  type Sale,
  type SaleLineItem,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { BarcodeInput } from "@/components/barcode-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote,
  Smartphone, Printer, CheckCircle, Search, History, X
} from "lucide-react";
import { formatCurrency } from "@/lib/format";

type CartItem = {
  itemId: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
};

type PaymentMethod = "Cash" | "Card" | "Mobile Money";

export default function POS() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [taxRate, setTaxRate] = useState(0);
  const [amountTendered, setAmountTendered] = useState("");
  const [receiptSale, setReceiptSale] = useState<Sale & { lineItems?: SaleLineItem[] } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isScanLookup, setIsScanLookup] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items } = useListItems();
  const { data: sales } = useListSales();
  const createSale = useCreateSale();

  const subtotal = cart.reduce((s, li) => s + li.quantity * li.unitPrice, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  const change = paymentMethod === "Cash" && amountTendered ? Number(amountTendered) - total : null;

  const filteredItems = (items ?? []).filter(i =>
    search === "" ||
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.barcode && i.barcode.includes(search))
  );

  function addToCart(item: Item) {
    setCart(prev => {
      const idx = prev.findIndex(c => c.itemId === item.id);
      if (idx >= 0) {
        return prev.map((c, i) => i === idx ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { itemId: item.id, description: item.name, quantity: 1, unitPrice: item.unitPrice }];
    });
  }

  function handleBarcodeScan(barcode: string) {
    const found = items?.find(i => i.barcode === barcode);
    if (found) {
      addToCart(found);
      toast({ title: `Added: ${found.name}` });
    } else {
      toast({ title: "Barcode not found", description: barcode, variant: "destructive" });
    }
    setIsScanLookup(false);
  }

  function updateQty(idx: number, delta: number) {
    setCart(prev => {
      const updated = prev.map((c, i) => i === idx ? { ...c, quantity: c.quantity + delta } : c);
      return updated.filter(c => c.quantity > 0);
    });
  }

  function removeFromCart(idx: number) {
    setCart(prev => prev.filter((_, i) => i !== idx));
  }

  function clearCart() {
    setCart([]);
    setAmountTendered("");
  }

  async function completeSale() {
    if (cart.length === 0) {
      toast({ title: "Cart is empty", variant: "destructive" });
      return;
    }
    if (paymentMethod === "Cash") {
      const tendered = Number(amountTendered);
      if (!amountTendered || tendered < total) {
        toast({ title: "Amount tendered is less than total", variant: "destructive" });
        return;
      }
    }

    createSale.mutate({
      data: {
        paymentMethod,
        taxRate,
        amountTendered: paymentMethod === "Cash" ? Number(amountTendered) : undefined,
        lineItems: cart.map(c => ({
          itemId: c.itemId ?? undefined,
          description: c.description,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
        })),
      }
    }, {
      onSuccess: (sale) => {
        queryClient.invalidateQueries({ queryKey: getListSalesQueryKey() });
        setReceiptSale(sale as Sale & { lineItems?: SaleLineItem[] });
        clearCart();
      },
      onError: () => {
        toast({ title: "Failed to complete sale", variant: "destructive" });
      }
    });
  }

  function printReceipt() {
    const printContent = receiptRef.current?.innerHTML;
    if (!printContent) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Receipt</title><style>
      body { font-family: monospace; font-size: 12px; max-width: 300px; margin: 0 auto; padding: 16px; }
      .divider { border-top: 1px dashed #000; margin: 8px 0; }
      .row { display: flex; justify-content: space-between; }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      .title { font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 8px; }
    </style></head><body>${printContent}</body></html>`);
    win.document.close();
    win.print();
  }

  const todaySales = (sales ?? []).filter(s => {
    const today = new Date().toDateString();
    return new Date(s.createdAt).toDateString() === today;
  });
  const todayTotal = todaySales.reduce((s, sale) => s + sale.total, 0);

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Left: Item grid + scanner */}
      <div className="flex flex-col flex-1 min-w-0 p-3 md:p-4 gap-3 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-2xl font-bold">Point of Sale</h1>
            <p className="text-sm text-muted-foreground">Today: {todaySales.length} sales · {formatCurrency(todayTotal)}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)} className="gap-2">
            <History className="h-4 w-4" />
            Sales History
          </Button>
        </div>

        {/* Barcode scanner bar */}
        <BarcodeInput
          onScan={handleBarcodeScan}
          isLoading={isScanLookup}
          placeholder="Scan barcode to add item to cart..."
          className="flex-shrink-0"
        />

        {/* Search */}
        <div className="relative flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Item grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pb-2">
            {filteredItems.map(item => (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                className="flex flex-col items-start gap-1 rounded-lg border bg-card p-3 text-left hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <span className="font-medium text-sm leading-tight line-clamp-2">{item.name}</span>
                <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                <span className="text-base font-bold text-primary mt-auto">{formatCurrency(item.unitPrice)}</span>
                {item.barcode && (
                  <span className="text-xs text-muted-foreground font-mono">{item.barcode}</span>
                )}
              </button>
            ))}
            {filteredItems.length === 0 && (
              <div className="col-span-3 py-8 text-center text-muted-foreground text-sm">
                No items found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Cart + payment */}
      <div className="w-full md:w-80 flex flex-col border-t md:border-t-0 md:border-l bg-muted/20 max-h-[50vh] md:max-h-none">
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-background">
          <ShoppingCart className="h-5 w-5" />
          <span className="font-semibold">Cart</span>
          {cart.length > 0 && (
            <Badge className="ml-auto">{cart.reduce((s, c) => s + c.quantity, 0)}</Badge>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {cart.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Cart is empty
            </div>
          ) : (
            cart.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded-md bg-background p-2 shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.description}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(item.unitPrice)} each</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(idx, -1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                  <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(idx, 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <div className="text-sm font-semibold w-16 text-right">
                  {formatCurrency(item.quantity * item.unitPrice)}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeFromCart(idx)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Totals + payment */}
        <div className="border-t p-3 space-y-3 bg-background">
          {/* Tax rate */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground flex-1">Tax (%)</span>
            <Input
              type="number"
              min={0}
              max={100}
              value={taxRate}
              onChange={e => setTaxRate(Number(e.target.value))}
              className="h-7 w-20 text-right"
            />
          </div>

          <Separator />

          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {taxRate > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Tax ({taxRate}%)</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>
          </div>

          <Separator />

          {/* Payment method */}
          <div className="grid grid-cols-3 gap-1">
            {(["Cash", "Card", "Mobile Money"] as const).map(pm => (
              <button
                key={pm}
                onClick={() => setPaymentMethod(pm)}
                className={`flex flex-col items-center gap-1 rounded-md border p-2 text-xs transition-colors ${
                  paymentMethod === pm
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:bg-accent"
                }`}
              >
                {pm === "Cash" && <Banknote className="h-4 w-4" />}
                {pm === "Card" && <CreditCard className="h-4 w-4" />}
                {pm === "Mobile Money" && <Smartphone className="h-4 w-4" />}
                <span>{pm}</span>
              </button>
            ))}
          </div>

          {paymentMethod === "Cash" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground flex-1">Amount tendered</span>
                <Input
                  type="number"
                  min={0}
                  value={amountTendered}
                  onChange={e => setAmountTendered(e.target.value)}
                  placeholder="0.00"
                  className="h-8 w-28 text-right font-mono text-base"
                />
              </div>
              {amountTendered !== "" && cart.length > 0 && (
                change !== null && change >= 0 ? (
                  <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3 text-center">
                    <p className="text-xs text-green-700 font-medium uppercase tracking-wide mb-0.5">Change Due</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(change)}</p>
                  </div>
                ) : (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-2 text-center">
                    <p className="text-xs text-red-600 font-medium">
                      Short by {formatCurrency(total - Number(amountTendered))}
                    </p>
                  </div>
                )
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={clearCart} disabled={cart.length === 0} className="flex-1">
              Clear
            </Button>
            <Button
              size="sm"
              onClick={completeSale}
              disabled={cart.length === 0 || createSale.isPending}
              className="flex-1 gap-1"
            >
              <CheckCircle className="h-4 w-4" />
              {createSale.isPending ? "Processing..." : "Charge"}
            </Button>
          </div>
        </div>
      </div>

      {/* Receipt dialog */}
      <Dialog open={!!receiptSale} onOpenChange={() => setReceiptSale(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Sale Complete!
            </DialogTitle>
          </DialogHeader>
          {receiptSale && (
            <div ref={receiptRef} className="font-mono text-xs space-y-1">
              <div className="title text-center font-bold text-base">BizManager POS</div>
              <div className="center text-center text-muted-foreground">{new Date(receiptSale.createdAt).toLocaleString()}</div>
              <div className="center text-center">{receiptSale.saleNumber}</div>
              <div className="divider border-t border-dashed my-2" />
              {receiptSale.lineItems?.map(li => (
                <div key={li.id} className="row flex justify-between">
                  <span className="flex-1">{li.description} x{li.quantity}</span>
                  <span>{formatCurrency(li.lineTotal)}</span>
                </div>
              ))}
              <div className="divider border-t border-dashed my-2" />
              <div className="row flex justify-between">
                <span>Subtotal</span><span>{formatCurrency(receiptSale.subtotal)}</span>
              </div>
              {receiptSale.taxRate > 0 && (
                <div className="row flex justify-between">
                  <span>Tax ({receiptSale.taxRate}%)</span><span>{formatCurrency(receiptSale.taxAmount)}</span>
                </div>
              )}
              <div className="row flex justify-between font-bold">
                <span>TOTAL</span><span>{formatCurrency(receiptSale.total)}</span>
              </div>
              <div className="row flex justify-between">
                <span>Payment</span><span>{receiptSale.paymentMethod}</span>
              </div>
              {receiptSale.amountTendered != null && (
                <div className="row flex justify-between">
                  <span>Tendered</span><span>{formatCurrency(receiptSale.amountTendered)}</span>
                </div>
              )}
              {receiptSale.change != null && (
                <div className="row flex justify-between">
                  <span>Change</span><span>{formatCurrency(receiptSale.change)}</span>
                </div>
              )}
              <div className="divider border-t border-dashed my-2" />
              <div className="center text-center text-muted-foreground">Thank you for your purchase!</div>
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1 gap-2" onClick={printReceipt}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button className="flex-1" onClick={() => setReceiptSale(null)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sales history dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sales History</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {(sales ?? []).length === 0 ? (
              <p className="text-center py-4 text-muted-foreground text-sm">No sales yet</p>
            ) : (
              [...(sales ?? [])].reverse().map(sale => (
                <div key={sale.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="font-medium text-sm">{sale.saleNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(sale.createdAt).toLocaleString()} · {sale.paymentMethod}
                    </p>
                  </div>
                  <span className="font-bold text-primary">{formatCurrency(sale.total)}</span>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
