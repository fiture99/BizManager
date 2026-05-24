import { useState } from "react";
import {
  useListInventory,
  useListLowStock,
  useAdjustStock,
  useUpdateInventoryLevel,
  useListStockAdjustments,
  getListInventoryQueryKey,
  getListLowStockQueryKey,
  getListStockAdjustmentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Search, AlertTriangle, TrendingUp, TrendingDown, History, Settings2, Boxes } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { BarcodeInput } from "@/components/barcode-input";

const adjustSchema = z.object({
  quantity: z.coerce.number().refine((v) => v !== 0, "Quantity cannot be zero"),
  reason: z.string().min(1, "Reason is required"),
  notes: z.string().optional(),
});

const reorderSchema = z.object({
  reorderPoint: z.coerce.number().min(0, "Must be 0 or more"),
});

type AdjustFormValues = z.infer<typeof adjustSchema>;
type ReorderFormValues = z.infer<typeof reorderSchema>;

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [showLowStock, setShowLowStock] = useState(false);
  const [adjustItem, setAdjustItem] = useState<{ id: number; name: string } | null>(null);
  const [reorderItem, setReorderItem] = useState<{ id: number; name: string; current: number } | null>(null);
  const [historyItem, setHistoryItem] = useState<{ id: number; name: string } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: inventory, isLoading } = useListInventory();
  const { data: lowStock } = useListLowStock();
  const { data: adjustments, isLoading: loadingHistory } = useListStockAdjustments(
    historyItem?.id ?? 0,
    { query: { queryKey: getListStockAdjustmentsQueryKey(historyItem?.id ?? 0), enabled: !!historyItem } }
  );
  const adjustStock = useAdjustStock();
  const updateLevel = useUpdateInventoryLevel();

  const adjustForm = useForm<AdjustFormValues>({
    resolver: zodResolver(adjustSchema),
    defaultValues: { quantity: 0, reason: "", notes: "" },
  });

  const reorderForm = useForm<ReorderFormValues>({
    resolver: zodResolver(reorderSchema),
    defaultValues: { reorderPoint: 0 },
  });

  const invalidateInventory = () => {
    queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListLowStockQueryKey() });
  };

  const filtered = (inventory ?? []).filter((inv) => {
    const q = search.toLowerCase();
    return inv.item?.name.toLowerCase().includes(q) || inv.item?.category.toLowerCase().includes(q) ||
      (inv.item?.barcode && inv.item.barcode.toLowerCase().includes(q));
  });

  const handleBarcodeScan = (barcode: string) => {
    const found = (inventory ?? []).find(inv => inv.item?.barcode === barcode);
    if (found && found.item) {
      setAdjustItem({ id: found.itemId, name: found.item.name });
      adjustForm.reset({ quantity: 0, reason: "", notes: "" });
      toast({ title: `Found: ${found.item.name} — opening stock adjust` });
    } else {
      toast({ title: "Barcode not found", description: barcode, variant: "destructive" });
    }
  };

  const handleAdjust = (values: AdjustFormValues) => {
    if (!adjustItem) return;
    adjustStock.mutate(
      { itemId: adjustItem.id, data: { quantity: values.quantity, reason: values.reason, notes: values.notes } },
      {
        onSuccess: () => {
          invalidateInventory();
          if (historyItem?.id === adjustItem.id) {
            queryClient.invalidateQueries({ queryKey: getListStockAdjustmentsQueryKey(adjustItem.id) });
          }
          toast({ title: `Stock adjusted by ${values.quantity > 0 ? "+" : ""}${values.quantity}` });
          setAdjustItem(null);
          adjustForm.reset({ quantity: 0, reason: "", notes: "" });
        },
        onError: () => toast({ title: "Failed to adjust stock", variant: "destructive" }),
      }
    );
  };

  const handleReorder = (values: ReorderFormValues) => {
    if (!reorderItem) return;
    updateLevel.mutate(
      { itemId: reorderItem.id, data: { reorderPoint: values.reorderPoint } },
      {
        onSuccess: () => {
          invalidateInventory();
          toast({ title: "Reorder point updated" });
          setReorderItem(null);
        },
        onError: () => toast({ title: "Failed to update reorder point", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground mt-1">Stock levels, adjustments, and reorder tracking.</p>
        </div>
        {lowStock && lowStock.length > 0 && (
          <Badge variant="destructive" className="gap-1.5 px-3 py-1.5 text-sm cursor-pointer" onClick={() => setShowLowStock(!showLowStock)}>
            <AlertTriangle className="w-4 h-4" /> {lowStock.length} Low Stock Alert{lowStock.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <BarcodeInput
        onScan={handleBarcodeScan}
        placeholder="Scan barcode to check & adjust stock..."
      />

      {showLowStock && lowStock && lowStock.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Items Below Reorder Point
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStock.map((inv) => (
                <Badge key={inv.itemId} variant="outline" className="border-destructive/40 text-destructive gap-1">
                  {inv.item?.name} — {inv.quantityOnHand} {inv.item?.unitOfMeasure} (reorder at {inv.reorderPoint})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">On Hand</TableHead>
                    <TableHead className="text-right">Reorder At</TableHead>
                    <TableHead className="text-right">Value (Cost)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Boxes className="w-8 h-8" />
                          <span>No inventory records found</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((inv) => {
                      const isLow = inv.quantityOnHand <= inv.reorderPoint;
                      const value = inv.quantityOnHand * (inv.item?.costPrice ?? 0);
                      return (
                        <TableRow key={inv.itemId}>
                          <TableCell>
                            <div className="font-medium">{inv.item?.name}</div>
                            <div className="text-xs text-muted-foreground">{inv.item?.unitOfMeasure}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">{inv.item?.category}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`font-semibold tabular-nums ${isLow ? "text-destructive" : ""}`}>
                              {inv.quantityOnHand}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground tabular-nums">{inv.reorderPoint}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatCurrency(value)}</TableCell>
                          <TableCell>
                            {isLow ? (
                              <Badge variant="destructive" className="gap-1 text-xs">
                                <AlertTriangle className="w-3 h-3" /> Low Stock
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs text-green-700 bg-green-50 border-green-200">In Stock</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 text-xs"
                                onClick={() => {
                                  setAdjustItem({ id: inv.itemId, name: inv.item?.name ?? "" });
                                  adjustForm.reset({ quantity: 0, reason: "", notes: "" });
                                }}
                              >
                                <TrendingUp className="w-3.5 h-3.5" /> Adjust
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 text-xs"
                                onClick={() => {
                                  setReorderItem({ id: inv.itemId, name: inv.item?.name ?? "", current: inv.reorderPoint });
                                  reorderForm.reset({ reorderPoint: inv.reorderPoint });
                                }}
                              >
                                <Settings2 className="w-3.5 h-3.5" /> Reorder
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 text-xs"
                                onClick={() => setHistoryItem({ id: inv.itemId, name: inv.item?.name ?? "" })}
                              >
                                <History className="w-3.5 h-3.5" /> History
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adjust Stock Dialog */}
      <Dialog open={!!adjustItem} onOpenChange={(open) => !open && setAdjustItem(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Adjust Stock — {adjustItem?.name}</DialogTitle>
          </DialogHeader>
          <Form {...adjustForm}>
            <form onSubmit={adjustForm.handleSubmit(handleAdjust)} className="space-y-4 pt-2">
              <FormField control={adjustForm.control} name="quantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity (use negative to reduce)</FormLabel>
                  <FormControl>
                    <Input type="number" step="1" placeholder="e.g. 10 or -5" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={adjustForm.control} name="reason" render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Stock count, Received shipment, Damaged goods" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={adjustForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Any additional details..." className="resize-none" rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAdjustItem(null)}>Cancel</Button>
                <Button type="submit" disabled={adjustStock.isPending}>
                  {adjustStock.isPending ? "Saving..." : "Apply Adjustment"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Reorder Point Dialog */}
      <Dialog open={!!reorderItem} onOpenChange={(open) => !open && setReorderItem(null)}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Set Reorder Point — {reorderItem?.name}</DialogTitle>
          </DialogHeader>
          <Form {...reorderForm}>
            <form onSubmit={reorderForm.handleSubmit(handleReorder)} className="space-y-4 pt-2">
              <FormField control={reorderForm.control} name="reorderPoint" render={({ field }) => (
                <FormItem>
                  <FormLabel>Reorder Point</FormLabel>
                  <FormControl><Input type="number" min="0" step="1" {...field} /></FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">A low-stock alert fires when on-hand quantity drops to or below this number.</p>
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setReorderItem(null)}>Cancel</Button>
                <Button type="submit" disabled={updateLevel.isPending}>{updateLevel.isPending ? "Saving..." : "Update"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Adjustment History Sheet */}
      <Sheet open={!!historyItem} onOpenChange={(open) => !open && setHistoryItem(null)}>
        <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Adjustment History — {historyItem?.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            {loadingHistory ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : !adjustments?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No adjustments recorded yet.</p>
              </div>
            ) : (
              [...adjustments].reverse().map((adj) => (
                <div key={adj.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                  <div className={`mt-0.5 rounded-full p-1.5 ${adj.quantity >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {adj.quantity >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-semibold tabular-nums ${adj.quantity >= 0 ? "text-green-700" : "text-red-700"}`}>
                        {adj.quantity >= 0 ? "+" : ""}{adj.quantity}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDate(adj.createdAt)}</span>
                    </div>
                    <p className="text-sm font-medium truncate">{adj.reason}</p>
                    {adj.notes && <p className="text-xs text-muted-foreground truncate">{adj.notes}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
