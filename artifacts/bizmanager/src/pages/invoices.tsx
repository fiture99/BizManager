import { useState } from "react";
import {
  useListInvoices,
  useCreateInvoice,
  useUpdateInvoice,
  useDeleteInvoice,
  useUpdateInvoiceStatus,
  useListCustomers,
  useListItems,
  getListInvoicesQueryKey,
  type Invoice,
  type InvoiceLineItem,
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
import { Plus, Trash2, MoreHorizontal, Pencil, Eye, Printer, FileText, X } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";

const lineItemSchema = z.object({
  itemId: z.coerce.number().optional(),
  description: z.string().min(1, "Description required"),
  quantity: z.coerce.number().min(0.01, "Must be > 0"),
  unitPrice: z.coerce.number().min(0, "Must be >= 0"),
});

const invoiceSchema = z.object({
  customerId: z.coerce.number().min(1, "Customer required"),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item required"),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700 border-gray-200",
  Sent: "bg-blue-50 text-blue-700 border-blue-200",
  Paid: "bg-green-50 text-green-700 border-green-200",
  Overdue: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  Draft: ["Sent"],
  Sent: ["Paid", "Overdue"],
  Overdue: ["Paid"],
  Paid: [],
};


export default function Invoices() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invoices, isLoading } = useListInvoices();
  const { data: customers } = useListCustomers();
  const { data: items } = useListItems();
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const deleteInvoice = useDeleteInvoice();
  const updateStatus = useUpdateInvoiceStatus();

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customerId: 0,
      issueDate: new Date().toISOString().split("T")[0],
      dueDate: "",
      taxRate: 0,
      notes: "",
      lineItems: [{ description: "", quantity: 1, unitPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lineItems" });

  const watchedLines = form.watch("lineItems");
  const watchedTaxRate = form.watch("taxRate") ?? 0;
  const subtotal = watchedLines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const taxAmount = subtotal * (Number(watchedTaxRate) / 100);
  const total = subtotal + taxAmount;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });

  const filtered = (invoices ?? []).filter((inv) => {
    const q = search.toLowerCase();
    const matchQ = inv.invoiceNumber.toLowerCase().includes(q) || (inv.customer?.name ?? "").toLowerCase().includes(q);
    const matchS = !statusFilter || inv.status === statusFilter;
    return matchQ && matchS;
  });

  const openCreate = () => {
    setEditingId(null);
    form.reset({
      customerId: 0,
      issueDate: new Date().toISOString().split("T")[0],
      dueDate: "",
      taxRate: 0,
      notes: "",
      lineItems: [{ description: "", quantity: 1, unitPrice: 0 }],
    });
    setFormOpen(true);
  };

  const openEdit = (inv: Invoice) => {
    setEditingId(inv.id);
    form.reset({
      customerId: inv.customerId,
      issueDate: inv.issueDate ? inv.issueDate.split("T")[0] : "",
      dueDate: inv.dueDate ? inv.dueDate.split("T")[0] : "",
      taxRate: inv.taxRate,
      notes: inv.notes ?? "",
      lineItems: (inv.lineItems ?? []).map((li: InvoiceLineItem) => ({
        itemId: li.itemId ?? undefined,
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
      })),
    });
    setFormOpen(true);
  };

  const onSubmit = (values: InvoiceFormValues) => {
    const payload = {
      ...values,
      issueDate: values.issueDate || undefined,
      dueDate: values.dueDate || undefined,
    };
    if (editingId) {
      updateInvoice.mutate(
        { id: editingId, data: payload },
        {
          onSuccess: () => { invalidate(); toast({ title: "Invoice updated" }); setFormOpen(false); },
          onError: () => toast({ title: "Failed to update invoice", variant: "destructive" }),
        }
      );
    } else {
      createInvoice.mutate(
        { data: payload },
        {
          onSuccess: () => { invalidate(); toast({ title: "Invoice created" }); setFormOpen(false); },
          onError: () => toast({ title: "Failed to create invoice", variant: "destructive" }),
        }
      );
    }
  };

  const handleDelete = (id: number) => {
    if (!window.confirm("Delete this invoice?")) return;
    deleteInvoice.mutate(
      { id },
      {
        onSuccess: () => { invalidate(); toast({ title: "Invoice deleted" }); },
        onError: () => toast({ title: "Failed to delete invoice", variant: "destructive" }),
      }
    );
  };

  const handleStatusChange = (id: number, status: string) => {
    updateStatus.mutate(
      { id, data: { status: status as "Draft" | "Sent" | "Paid" | "Overdue" } },
      {
        onSuccess: (updated) => {
          invalidate();
          toast({ title: `Invoice marked as ${status}` });
          if (viewInvoice?.id === id) setViewInvoice(updated as Invoice);
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
    form.setValue(`lineItems.${index}.unitPrice`, item.unitPrice);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground mt-1">Create, send, and track customer invoices.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> New Invoice
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search invoices..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {["", "Draft", "Sent", "Paid", "Overdue"].map((s) => (
                <Button
                  key={s}
                  variant={statusFilter === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(s)}
                >
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
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Issue Date</TableHead>
                    <TableHead>Due Date</TableHead>
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
                          <FileText className="w-8 h-8" />
                          <span>No invoices found</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((inv) => (
                      <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setViewInvoice(inv)}>
                        <TableCell className="font-mono font-medium text-sm">{inv.invoiceNumber}</TableCell>
                        <TableCell className="font-medium">{inv.customer?.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{inv.issueDate ? formatDate(inv.issueDate) : "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{inv.dueDate ? formatDate(inv.dueDate) : "—"}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Badge className={`text-xs border ${STATUS_COLORS[inv.status] ?? ""}`}>{inv.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(inv.total)}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewInvoice(inv)}><Eye className="mr-2 h-4 w-4" />View</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(inv)}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                              {STATUS_TRANSITIONS[inv.status]?.map((s) => (
                                <DropdownMenuItem key={s} onClick={() => handleStatusChange(inv.id, s)}>
                                  Mark as {s}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDelete(inv.id)} className="text-destructive">
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

      {/* Invoice Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Invoice" : "New Invoice"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="customerId" render={({ field }) => (
                  <FormItem className="col-span-2 sm:col-span-1">
                    <FormLabel>Customer</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value={0}>Select customer...</option>
                        {(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="taxRate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Rate (%)</FormLabel>
                    <FormControl><Input type="number" min="0" max="100" step="0.1" placeholder="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="issueDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issue Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="dueDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <FormLabel className="text-base font-semibold">Line Items</FormLabel>
                  <Button type="button" variant="outline" size="sm" onClick={() => append({ description: "", quantity: 1, unitPrice: 0 })} className="gap-1">
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
                        <TableHead className="w-[110px]">Unit Price</TableHead>
                        <TableHead className="w-[110px] text-right">Total</TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.map((field, index) => {
                        const qty = Number(watchedLines[index]?.quantity) || 0;
                        const price = Number(watchedLines[index]?.unitPrice) || 0;
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
                              <Input {...form.register(`lineItems.${index}.unitPrice`)} type="number" min="0" step="0.01" className="h-8 text-sm" />
                            </TableCell>
                            <TableCell className="text-right py-2 px-2 font-medium text-sm">{formatCurrency(qty * price)}</TableCell>
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
                {form.formState.errors.lineItems?.root && (
                  <p className="text-sm text-destructive mt-1">{form.formState.errors.lineItems.root.message}</p>
                )}
              </div>

              <div className="flex justify-end">
                <div className="w-64 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tax ({watchedTaxRate}%)</span><span>{formatCurrency(taxAmount)}</span></div>
                  <Separator />
                  <div className="flex justify-between text-base font-bold"><span>Total</span><span>{formatCurrency(total)}</span></div>
                </div>
              </div>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea placeholder="Payment terms, bank details, etc." className="resize-none" rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createInvoice.isPending || updateInvoice.isPending}>
                  {createInvoice.isPending || updateInvoice.isPending ? "Saving..." : editingId ? "Save Changes" : "Create Invoice"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Invoice Detail / Print View */}
      <Sheet open={!!viewInvoice} onOpenChange={(open) => !open && setViewInvoice(null)}>
        <SheetContent className="w-full sm:max-w-[640px] overflow-y-auto p-0">
          {viewInvoice && (
            <div>
              {/* Toolbar */}
              <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30 print:hidden">
                <div className="flex items-center gap-3">
                  <Badge className={`text-xs border ${STATUS_COLORS[viewInvoice.status] ?? ""}`}>{viewInvoice.status}</Badge>
                  {STATUS_TRANSITIONS[viewInvoice.status]?.map((s) => (
                    <Button key={s} size="sm" variant="outline" onClick={() => handleStatusChange(viewInvoice.id, s)}>
                      Mark as {s}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { openEdit(viewInvoice); setViewInvoice(null); }}>
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.print()}>
                    <Printer className="w-3.5 h-3.5" /> Print
                  </Button>
                </div>
              </div>

              {/* Invoice Document */}
              <div id="invoice-print" className="p-8 space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">INVOICE</h2>
                    <p className="text-muted-foreground font-mono text-sm mt-1">{viewInvoice.invoiceNumber}</p>
                  </div>
                  <div className="text-right text-sm">
                    {viewInvoice.issueDate && <div><span className="text-muted-foreground">Issue: </span>{formatDate(viewInvoice.issueDate)}</div>}
                    {viewInvoice.dueDate && <div><span className="text-muted-foreground">Due: </span>{formatDate(viewInvoice.dueDate)}</div>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Bill To</p>
                    <p className="font-semibold">{viewInvoice.customer?.name}</p>
                    {viewInvoice.customer?.email && <p className="text-sm text-muted-foreground">{viewInvoice.customer.email}</p>}
                    {viewInvoice.customer?.phone && <p className="text-sm text-muted-foreground">{viewInvoice.customer.phone}</p>}
                    {viewInvoice.customer?.address && <p className="text-sm text-muted-foreground">{viewInvoice.customer.address}</p>}
                    {(viewInvoice.customer?.city || viewInvoice.customer?.country) && (
                      <p className="text-sm text-muted-foreground">{[viewInvoice.customer.city, viewInvoice.customer.country].filter(Boolean).join(", ")}</p>
                    )}
                  </div>
                </div>

                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right w-[80px]">Qty</TableHead>
                        <TableHead className="text-right w-[100px]">Unit Price</TableHead>
                        <TableHead className="text-right w-[110px]">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(viewInvoice.lineItems ?? []).map((li: InvoiceLineItem) => (
                        <TableRow key={li.id}>
                          <TableCell className="font-medium">{li.description}</TableCell>
                          <TableCell className="text-right tabular-nums">{li.quantity}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(li.unitPrice)}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{formatCurrency(li.lineTotal)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end">
                  <div className="w-60 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(viewInvoice.subtotal)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Tax ({viewInvoice.taxRate}%)</span><span>{formatCurrency(viewInvoice.taxAmount)}</span></div>
                    <Separator />
                    <div className="flex justify-between font-bold text-base"><span>Total</span><span>{formatCurrency(viewInvoice.total)}</span></div>
                  </div>
                </div>

                {viewInvoice.notes && (
                  <div className="rounded-md bg-muted/40 p-4 text-sm">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                    <p className="text-muted-foreground">{viewInvoice.notes}</p>
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
