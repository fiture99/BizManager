import { useState } from "react";
import {
  useListPurchaseOrders,
  useCreatePurchaseOrder,
  useUpdatePurchaseOrder,
  useDeletePurchaseOrder,
  useUpdatePurchaseOrderStatus,
  useListSuppliers,
  useListItems,
  getListPurchaseOrdersQueryKey,
  getListInventoryQueryKey,
  getListLowStockQueryKey,
  type PurchaseOrder,
  type PurchaseOrderLineItem,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, MoreHorizontal, Pencil, Eye, ShoppingCart, X, CheckCircle2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { BarcodeInput } from "@/components/barcode-input";

const lineItemSchema = z.object({
  itemId: z.coerce.number().optional(),
  description: z.string().min(1, "Description required"),
  quantity: z.coerce.number().min(0.01, "Must be > 0"),
  unitCost: z.coerce.number().min(0, "Must be >= 0"),
});

const poSchema = z.object({
  supplierId: z.coerce.number().min(1, "Supplier required"),
  orderDate: z.string().optional(),
  expectedDate: z.string().optional(),
  notes: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item required"),
});

type POFormValues = z.infer<typeof poSchema>;

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700 border-gray-200",
  Sent: "bg-blue-50 text-blue-700 border-blue-200",
  Received: "bg-green-50 text-green-700 border-green-200",
  Cancelled: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  Draft: ["Sent", "Cancelled"],
  Sent: ["Received", "Cancelled"],
  Received: [],
  Cancelled: [],
};

type PO = PurchaseOrder;
type POLineItem = PurchaseOrderLineItem;

export default function PurchaseOrders() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewPO, setViewPO] = useState<PO | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: orders, isLoading } = useListPurchaseOrders();
  const { data: suppliers } = useListSuppliers();
  const { data: items } = useListItems();
  const createPO = useCreatePurchaseOrder();
  const updatePO = useUpdatePurchaseOrder();
  const deletePO = useDeletePurchaseOrder();
  const updateStatus = useUpdatePurchaseOrderStatus();

  const form = useForm<POFormValues>({
    resolver: zodResolver(poSchema),
    defaultValues: {
      supplierId: 0,
      orderDate: new Date().toISOString().split("T")[0],
      expectedDate: "",
      notes: "",
      lineItems: [{ description: "", quantity: 1, unitCost: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lineItems" });

  const watchedLines = form.watch("lineItems");
  const subtotal = watchedLines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListLowStockQueryKey() });
  };

  const handleBarcodeScan = (barcode: string) => {
    const found = (items ?? []).find(i => i.barcode === barcode);
    if (found) {
      if (formOpen) {
        append({ itemId: found.id, description: found.name, quantity: 1, unitCost: found.costPrice });
        toast({ title: `Added: ${found.name}` });
      } else {
        toast({ title: `Scanned: ${found.name}`, description: `Open a PO form to add items by barcode.` });
      }
    } else {
      toast({ title: "Barcode not found", description: barcode, variant: "destructive" });
    }
  };

  const filtered = (orders ?? []).filter((po) => {
    const q = search.toLowerCase();
    const matchQ = po.poNumber.toLowerCase().includes(q) || (po.supplier?.name ?? "").toLowerCase().includes(q);
    const matchS = !statusFilter || po.status === statusFilter;
    return matchQ && matchS;
  });

  const openCreate = () => {
    setEditingId(null);
    form.reset({
      supplierId: 0,
      orderDate: new Date().toISOString().split("T")[0],
      expectedDate: "",
      notes: "",
      lineItems: [{ description: "", quantity: 1, unitCost: 0 }],
    });
    setFormOpen(true);
  };

  const openEdit = (po: PO) => {
    setEditingId(po.id);
    form.reset({
      supplierId: po.supplierId,
      orderDate: po.orderDate ? po.orderDate.split("T")[0] : "",
      expectedDate: po.expectedDate ? po.expectedDate.split("T")[0] : "",
      notes: po.notes ?? "",
      lineItems: (po.lineItems ?? []).map((li: POLineItem) => ({
        itemId: li.itemId ?? undefined,
        description: li.description,
        quantity: li.quantity,
        unitCost: li.unitCost,
      })),
    });
    setFormOpen(true);
  };

  const onSubmit = (values: POFormValues) => {
    const payload = {
      ...values,
      orderDate: values.orderDate || undefined,
      expectedDate: values.expectedDate || undefined,
    };
    if (editingId) {
      updatePO.mutate(
        { id: editingId, data: payload },
        {
          onSuccess: () => { invalidate(); toast({ title: "Purchase order updated" }); setFormOpen(false); },
          onError: () => toast({ title: "Failed to update purchase order", variant: "destructive" }),
        }
      );
    } else {
      createPO.mutate(
        { data: payload },
        {
          onSuccess: () => { invalidate(); toast({ title: "Purchase order created" }); setFormOpen(false); },
          onError: () => toast({ title: "Failed to create purchase order", variant: "destructive" }),
        }
      );
    }
  };

  const handleDelete = (id: number) => {
    if (!window.confirm("Delete this purchase order?")) return;
    deletePO.mutate(
      { id },
      {
        onSuccess: () => { invalidate(); toast({ title: "Purchase order deleted" }); },
        onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
      }
    );
  };

  const handleStatusChange = (id: number, status: string) => {
    const isReceiving = status === "Received";
    if (isReceiving && !window.confirm("Mark as Received? This will automatically update inventory stock levels.")) return;
    updateStatus.mutate(
      { id, data: { status: status as "Draft" | "Sent" | "Received" | "Cancelled" } },
      {
        onSuccess: (updated) => {
          invalidate();
          toast({ title: isReceiving ? "PO received — inventory updated" : `Status set to ${status}` });
          if (viewPO?.id === id) setViewPO(updated as PO);
        },
        onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
      }
    );
  };

  const selectItem = (index: number, itemId: number) => {
    const item = items?.find((i) => i.id === itemId);
    if (!item) return;
    form.setValue(`lineItems.${index}.itemId`, itemId);
    form.setValue(`lineItems.${index}.description`, item.name);
    form.setValue(`lineItems.${index}.unitCost`, item.costPrice);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-muted-foreground mt-1">Order stock from suppliers and track deliveries.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> New Purchase Order
        </Button>
      </div>

      <BarcodeInput
        onScan={handleBarcodeScan}
        placeholder={formOpen ? "Scan barcode to add item to current order..." : "Scan barcode to look up an item..."}
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <ShoppingCart className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search purchase orders..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {["", "Draft", "Sent", "Received", "Cancelled"].map((s) => (
                <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)}>
                  {s || "All"}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO #</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <ShoppingCart className="w-8 h-8" />
                          <span>No purchase orders found</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((po) => (
                      <TableRow key={po.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setViewPO(po)}>
                        <TableCell className="font-mono font-medium text-sm">{po.poNumber}</TableCell>
                        <TableCell className="font-medium">{po.supplier?.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{po.orderDate ? formatDate(po.orderDate) : "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{po.expectedDate ? formatDate(po.expectedDate) : "—"}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Badge className={`text-xs border ${STATUS_COLORS[po.status] ?? ""}`}>{po.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(po.total)}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewPO(po)}><Eye className="mr-2 h-4 w-4" />View</DropdownMenuItem>
                              {po.status === "Draft" && <DropdownMenuItem onClick={() => openEdit(po)}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>}
                              {STATUS_TRANSITIONS[po.status]?.map((s) => (
                                <DropdownMenuItem key={s} onClick={() => handleStatusChange(po.id, s)}>
                                  {s === "Received" && <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />}
                                  {s !== "Received" && <MoreHorizontal className="mr-2 h-4 w-4" />}
                                  Mark as {s}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDelete(po.id)} className="text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" />Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PO Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Purchase Order" : "New Purchase Order"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="supplierId" render={({ field }) => (
                  <FormItem className="col-span-2 sm:col-span-1">
                    <FormLabel>Supplier</FormLabel>
                    <FormControl>
                      <select {...field} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                        <option value={0}>Select supplier...</option>
                        {(suppliers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div />
                <FormField control={form.control} name="orderDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="expectedDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Delivery</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-base font-semibold">Line Items</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => append({ description: "", quantity: 1, unitCost: 0 })} className="gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add Line
                  </Button>
                </div>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[200px]">Item</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-[90px]">Qty</TableHead>
                        <TableHead className="w-[110px]">Unit Cost</TableHead>
                        <TableHead className="w-[110px] text-right">Total</TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.map((field, index) => {
                        const qty = Number(watchedLines[index]?.quantity) || 0;
                        const cost = Number(watchedLines[index]?.unitCost) || 0;
                        return (
                          <TableRow key={field.id}>
                            <TableCell className="py-2 px-2">
                              <select
                                value={form.watch(`lineItems.${index}.itemId`) ?? ""}
                                onChange={(e) => selectItem(index, Number(e.target.value))}
                                className="w-full h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                              >
                                <option value="">Select item...</option>
                                {(items ?? []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                              </select>
                            </TableCell>
                            <TableCell className="py-2 px-2">
                              <Input {...form.register(`lineItems.${index}.description`)} placeholder="Description" className="h-8 text-sm" />
                            </TableCell>
                            <TableCell className="py-2 px-2">
                              <Input {...form.register(`lineItems.${index}.quantity`)} type="number" min="0.01" step="0.01" className="h-8 text-sm" />
                            </TableCell>
                            <TableCell className="py-2 px-2">
                              <Input {...form.register(`lineItems.${index}.unitCost`)} type="number" min="0" step="0.01" className="h-8 text-sm" />
                            </TableCell>
                            <TableCell className="text-right py-2 px-2 font-medium text-sm">{formatCurrency(qty * cost)}</TableCell>
                            <TableCell className="py-2 px-1">
                              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => remove(index)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex justify-end">
                <div className="w-52 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
                  <Separator />
                  <div className="flex justify-between text-base font-bold"><span>Total</span><span>{formatCurrency(subtotal)}</span></div>
                </div>
              </div>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea placeholder="Delivery instructions, special requests, etc." className="resize-none" rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createPO.isPending || updatePO.isPending}>
                  {createPO.isPending || updatePO.isPending ? "Saving..." : editingId ? "Save Changes" : "Create PO"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* PO Detail Sheet */}
      <Sheet open={!!viewPO} onOpenChange={(open) => !open && setViewPO(null)}>
        <SheetContent className="w-full sm:max-w-[640px] overflow-y-auto p-0">
          {viewPO && (
            <div>
              <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
                <div className="flex items-center gap-3">
                  <Badge className={`text-xs border ${STATUS_COLORS[viewPO.status] ?? ""}`}>{viewPO.status}</Badge>
                  {STATUS_TRANSITIONS[viewPO.status]?.map((s) => (
                    <Button key={s} size="sm" variant={s === "Received" ? "default" : "outline"} onClick={() => handleStatusChange(viewPO.id, s)} className="gap-1.5">
                      {s === "Received" && <CheckCircle2 className="w-3.5 h-3.5" />}
                      Mark as {s}
                    </Button>
                  ))}
                </div>
                {viewPO.status === "Draft" && (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { openEdit(viewPO); setViewPO(null); }}>
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                )}
              </div>

              <div className="p-8 space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">PURCHASE ORDER</h2>
                    <p className="text-muted-foreground font-mono text-sm mt-1">{viewPO.poNumber}</p>
                  </div>
                  <div className="text-right text-sm">
                    {viewPO.orderDate && <div><span className="text-muted-foreground">Order: </span>{formatDate(viewPO.orderDate)}</div>}
                    {viewPO.expectedDate && <div><span className="text-muted-foreground">Expected: </span>{formatDate(viewPO.expectedDate)}</div>}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Supplier</p>
                  <p className="font-semibold">{viewPO.supplier?.name}</p>
                  {viewPO.supplier?.contactPerson && <p className="text-sm text-muted-foreground">{viewPO.supplier.contactPerson}</p>}
                  {viewPO.supplier?.email && <p className="text-sm text-muted-foreground">{viewPO.supplier.email}</p>}
                  {viewPO.supplier?.phone && <p className="text-sm text-muted-foreground">{viewPO.supplier.phone}</p>}
                </div>

                {viewPO.status === "Received" && (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 border border-green-200 text-green-700 text-sm">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    Inventory has been updated with items from this order.
                  </div>
                )}

                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right w-[80px]">Qty</TableHead>
                        <TableHead className="text-right w-[110px]">Unit Cost</TableHead>
                        <TableHead className="text-right w-[110px]">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(viewPO.lineItems ?? []).map((li: POLineItem) => (
                        <TableRow key={li.id}>
                          <TableCell className="font-medium">{li.description}</TableCell>
                          <TableCell className="text-right tabular-nums">{li.quantity}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(li.unitCost)}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{formatCurrency(li.lineTotal)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end">
                  <div className="w-52 space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(viewPO.subtotal)}</span></div>
                    <Separator />
                    <div className="flex justify-between font-bold text-base"><span>Total</span><span>{formatCurrency(viewPO.total)}</span></div>
                  </div>
                </div>

                {viewPO.notes && (
                  <div className="rounded-md bg-muted/40 p-4 text-sm">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                    <p className="text-muted-foreground">{viewPO.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
