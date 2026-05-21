import { useState } from "react";
import {
  useListItems,
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
  getListItemsQueryKey,
  type Item,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { BarcodeInput } from "@/components/barcode-input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Package, Barcode } from "lucide-react";
import { formatCurrency } from "@/lib/format";

const itemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  unitPrice: z.coerce.number().min(0, "Must be 0 or more"),
  costPrice: z.coerce.number().min(0, "Must be 0 or more"),
  unitOfMeasure: z.string().min(1, "Unit of measure is required"),
  barcode: z.string().optional(),
  expiryDate: z.string().optional(),
});

type ItemFormValues = z.infer<typeof itemSchema>;

export default function Items() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useListItems();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: { name: "", description: "", category: "", unitPrice: 0, costPrice: 0, unitOfMeasure: "Each", barcode: "", expiryDate: "" },
  });

  const categories = Array.from(new Set(items?.map((i) => i.category) ?? [])).sort();

  const filtered = (items ?? []).filter((i) => {
    const q = search.toLowerCase();
    const matchesSearch =
      i.name.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q) ||
      (i.barcode && i.barcode.toLowerCase().includes(q));
    const matchesCat = categoryFilter === "" || i.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const handleBarcodeScan = (barcode: string) => {
    const found = items?.find(i => i.barcode === barcode);
    if (found) {
      setHighlightedId(found.id);
      setSearch(found.name);
      setTimeout(() => setHighlightedId(null), 3000);
      toast({ title: `Found: ${found.name}` });
    } else {
      toast({ title: "Barcode not found", description: `No item with barcode: ${barcode}`, variant: "destructive" });
    }
  };

  const openCreate = () => {
    setEditingId(null);
    form.reset({ name: "", description: "", category: "", unitPrice: 0, costPrice: 0, unitOfMeasure: "Each", barcode: "", expiryDate: "" });
    setDialogOpen(true);
  };

  const openEdit = (item: Item) => {
    setEditingId(item.id);
    form.reset({
      name: item.name,
      description: item.description ?? "",
      category: item.category,
      unitPrice: item.unitPrice,
      costPrice: item.costPrice,
      unitOfMeasure: item.unitOfMeasure,
      barcode: item.barcode ?? "",
      expiryDate: item.expiryDate ?? "",
    });
    setDialogOpen(true);
  };

  const onSubmit = (values: ItemFormValues) => {
    const invalidate = () => queryClient.invalidateQueries({ queryKey: getListItemsQueryKey() });
    const payload = {
      ...values,
      barcode: values.barcode || undefined,
      expiryDate: values.expiryDate || undefined,
    };
    if (editingId) {
      updateItem.mutate(
        { id: editingId, data: payload },
        {
          onSuccess: () => { invalidate(); toast({ title: "Item updated" }); setDialogOpen(false); },
          onError: () => toast({ title: "Failed to update item", variant: "destructive" }),
        }
      );
    } else {
      createItem.mutate(
        { data: payload },
        {
          onSuccess: () => { invalidate(); toast({ title: "Item created" }); setDialogOpen(false); },
          onError: () => toast({ title: "Failed to create item", variant: "destructive" }),
        }
      );
    }
  };

  const handleDelete = (id: number) => {
    if (!window.confirm("Delete this item? This cannot be undone.")) return;
    deleteItem.mutate(
      { id },
      {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListItemsQueryKey() }); toast({ title: "Item deleted" }); },
        onError: () => toast({ title: "Failed to delete item", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Items</h1>
          <p className="text-muted-foreground mt-1">Products and services you sell or purchase.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Add Item
        </Button>
      </div>

      {/* Barcode scanner bar */}
      <BarcodeInput
        onScan={handleBarcodeScan}
        placeholder="Scan barcode to find an item..."
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Barcode</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Cost Price</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Package className="w-8 h-8" />
                          <span>No items found</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((item) => {
                      const margin = item.unitPrice > 0 ? ((item.unitPrice - item.costPrice) / item.unitPrice) * 100 : 0;
                      const isHighlighted = item.id === highlightedId;
                      return (
                        <TableRow key={item.id} className={isHighlighted ? "bg-primary/10 ring-2 ring-primary transition-all" : ""}>
                          <TableCell>
                            <div className="font-medium">{item.name}</div>
                            {item.description && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{item.description}</div>}
                          </TableCell>
                          <TableCell><Badge variant="secondary">{item.category}</Badge></TableCell>
                          <TableCell className="text-muted-foreground text-sm">{item.unitOfMeasure}</TableCell>
                          <TableCell>
                            {item.barcode ? (
                              <div className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                                <Barcode className="h-3 w-3" />
                                {item.barcode}
                              </div>
                            ) : <span className="text-xs text-muted-foreground/50">—</span>}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.expiryDate ?? <span className="text-muted-foreground/50">—</span>}
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(item.unitPrice)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatCurrency(item.costPrice)}</TableCell>
                          <TableCell className="text-right">
                            <span className={margin >= 30 ? "text-green-600" : margin >= 10 ? "text-yellow-600" : "text-red-600"}>
                              {margin.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEdit(item)}>
                                  <Pencil className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(item.id)} className="text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Item" : "Add New Item"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input placeholder="Wireless Keyboard" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea placeholder="Optional description..." className="resize-none" rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl><Input placeholder="Electronics" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="unitOfMeasure" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit of Measure</FormLabel>
                    <FormControl><Input placeholder="Each" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="unitPrice" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Price (sell)</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" placeholder="0.00" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="costPrice" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost Price (buy)</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" placeholder="0.00" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="barcode" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Barcode (optional)</FormLabel>
                    <FormControl><Input placeholder="1234567890128" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="expiryDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry Date (optional)</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createItem.isPending || updateItem.isPending}>
                  {createItem.isPending || updateItem.isPending ? "Saving..." : editingId ? "Save Changes" : "Create Item"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
