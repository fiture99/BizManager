"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/schema/index.ts
var index_exports = {};
__export(index_exports, {
  customersTable: () => customersTable,
  insertCustomerSchema: () => insertCustomerSchema,
  insertInventoryLevelSchema: () => insertInventoryLevelSchema,
  insertInvoiceLineItemSchema: () => insertInvoiceLineItemSchema,
  insertInvoiceSchema: () => insertInvoiceSchema,
  insertItemSchema: () => insertItemSchema,
  insertPurchaseOrderLineItemSchema: () => insertPurchaseOrderLineItemSchema,
  insertPurchaseOrderSchema: () => insertPurchaseOrderSchema,
  insertSaleLineItemSchema: () => insertSaleLineItemSchema,
  insertSaleSchema: () => insertSaleSchema,
  insertStockAdjustmentSchema: () => insertStockAdjustmentSchema,
  insertSupplierSchema: () => insertSupplierSchema,
  insertUserSchema: () => insertUserSchema,
  inventoryLevelsTable: () => inventoryLevelsTable,
  invoiceLineItemsTable: () => invoiceLineItemsTable,
  invoicesTable: () => invoicesTable,
  itemsTable: () => itemsTable,
  purchaseOrderLineItemsTable: () => purchaseOrderLineItemsTable,
  purchaseOrdersTable: () => purchaseOrdersTable,
  saleLineItemsTable: () => saleLineItemsTable,
  salesTable: () => salesTable,
  stockAdjustmentsTable: () => stockAdjustmentsTable,
  suppliersTable: () => suppliersTable,
  usersTable: () => usersTable
});
module.exports = __toCommonJS(index_exports);

// src/schema/items.ts
var import_pg_core = require("drizzle-orm/pg-core");
var import_drizzle_zod = require("drizzle-zod");
var itemsTable = (0, import_pg_core.pgTable)("items", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  name: (0, import_pg_core.text)("name").notNull(),
  description: (0, import_pg_core.text)("description"),
  sku: (0, import_pg_core.text)("sku").unique(),
  category: (0, import_pg_core.text)("category"),
  unitPrice: (0, import_pg_core.numeric)("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
  costPrice: (0, import_pg_core.numeric)("cost_price", { precision: 12, scale: 2 }).notNull().default("0"),
  unit: (0, import_pg_core.text)("unit").notNull().default("unit"),
  expiryDate: (0, import_pg_core.timestamp)("expiry_date", { withTimezone: true }),
  createdAt: (0, import_pg_core.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow()
});
var insertItemSchema = (0, import_drizzle_zod.createInsertSchema)(itemsTable).omit({ id: true, createdAt: true });

// src/schema/inventory.ts
var import_pg_core2 = require("drizzle-orm/pg-core");
var import_drizzle_zod2 = require("drizzle-zod");
var inventoryLevelsTable = (0, import_pg_core2.pgTable)("inventory_levels", {
  itemId: (0, import_pg_core2.integer)("item_id").primaryKey().references(() => itemsTable.id, { onDelete: "cascade" }),
  quantityOnHand: (0, import_pg_core2.numeric)("quantity_on_hand", { precision: 12, scale: 2 }).notNull().default("0"),
  reorderPoint: (0, import_pg_core2.numeric)("reorder_point", { precision: 12, scale: 2 }).notNull().default("0"),
  updatedAt: (0, import_pg_core2.timestamp)("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var stockAdjustmentsTable = (0, import_pg_core2.pgTable)("stock_adjustments", {
  id: (0, import_pg_core2.serial)("id").primaryKey(),
  itemId: (0, import_pg_core2.integer)("item_id").notNull().references(() => itemsTable.id, { onDelete: "cascade" }),
  quantity: (0, import_pg_core2.numeric)("quantity", { precision: 12, scale: 2 }).notNull(),
  reason: (0, import_pg_core2.text)("reason").notNull(),
  notes: (0, import_pg_core2.text)("notes"),
  status: (0, import_pg_core2.text)("status").notNull().default("draft"),
  createdBy: (0, import_pg_core2.integer)("created_by"),
  approvedBy: (0, import_pg_core2.integer)("approved_by"),
  approvedAt: (0, import_pg_core2.timestamp)("approved_at", { withTimezone: true }),
  createdAt: (0, import_pg_core2.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow()
});
var insertInventoryLevelSchema = (0, import_drizzle_zod2.createInsertSchema)(inventoryLevelsTable).omit({ updatedAt: true });
var insertStockAdjustmentSchema = (0, import_drizzle_zod2.createInsertSchema)(stockAdjustmentsTable).omit({ id: true, createdAt: true });

// src/schema/customers.ts
var import_pg_core3 = require("drizzle-orm/pg-core");
var import_drizzle_zod3 = require("drizzle-zod");
var customersTable = (0, import_pg_core3.pgTable)("customers", {
  id: (0, import_pg_core3.serial)("id").primaryKey(),
  name: (0, import_pg_core3.text)("name").notNull(),
  email: (0, import_pg_core3.text)("email"),
  phone: (0, import_pg_core3.text)("phone"),
  address: (0, import_pg_core3.text)("address"),
  createdAt: (0, import_pg_core3.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow()
});
var insertCustomerSchema = (0, import_drizzle_zod3.createInsertSchema)(customersTable).omit({ id: true, createdAt: true });

// src/schema/suppliers.ts
var import_pg_core4 = require("drizzle-orm/pg-core");
var import_drizzle_zod4 = require("drizzle-zod");
var suppliersTable = (0, import_pg_core4.pgTable)("suppliers", {
  id: (0, import_pg_core4.serial)("id").primaryKey(),
  name: (0, import_pg_core4.text)("name").notNull(),
  email: (0, import_pg_core4.text)("email"),
  phone: (0, import_pg_core4.text)("phone"),
  address: (0, import_pg_core4.text)("address"),
  createdAt: (0, import_pg_core4.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow()
});
var insertSupplierSchema = (0, import_drizzle_zod4.createInsertSchema)(suppliersTable).omit({ id: true, createdAt: true });

// src/schema/invoices.ts
var import_pg_core5 = require("drizzle-orm/pg-core");
var import_drizzle_zod5 = require("drizzle-zod");
var invoicesTable = (0, import_pg_core5.pgTable)("invoices", {
  id: (0, import_pg_core5.serial)("id").primaryKey(),
  invoiceNumber: (0, import_pg_core5.text)("invoice_number").notNull().unique(),
  customerId: (0, import_pg_core5.integer)("customer_id").notNull().references(() => customersTable.id),
  status: (0, import_pg_core5.text)("status").notNull().default("draft"),
  issueDate: (0, import_pg_core5.timestamp)("issue_date", { withTimezone: true }),
  dueDate: (0, import_pg_core5.timestamp)("due_date", { withTimezone: true }),
  subtotal: (0, import_pg_core5.numeric)("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  taxRate: (0, import_pg_core5.numeric)("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  taxAmount: (0, import_pg_core5.numeric)("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  total: (0, import_pg_core5.numeric)("total", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: (0, import_pg_core5.text)("notes"),
  createdBy: (0, import_pg_core5.integer)("created_by"),
  approvedBy: (0, import_pg_core5.integer)("approved_by"),
  approvedAt: (0, import_pg_core5.timestamp)("approved_at", { withTimezone: true }),
  createdAt: (0, import_pg_core5.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow()
});
var invoiceLineItemsTable = (0, import_pg_core5.pgTable)("invoice_line_items", {
  id: (0, import_pg_core5.serial)("id").primaryKey(),
  invoiceId: (0, import_pg_core5.integer)("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }),
  itemId: (0, import_pg_core5.integer)("item_id").references(() => itemsTable.id, { onDelete: "set null" }),
  description: (0, import_pg_core5.text)("description").notNull(),
  quantity: (0, import_pg_core5.numeric)("quantity", { precision: 12, scale: 2 }).notNull(),
  unitPrice: (0, import_pg_core5.numeric)("unit_price", { precision: 12, scale: 2 }).notNull(),
  lineTotal: (0, import_pg_core5.numeric)("line_total", { precision: 12, scale: 2 }).notNull()
});
var insertInvoiceSchema = (0, import_drizzle_zod5.createInsertSchema)(invoicesTable).omit({ id: true, createdAt: true });
var insertInvoiceLineItemSchema = (0, import_drizzle_zod5.createInsertSchema)(invoiceLineItemsTable).omit({ id: true });

// src/schema/purchase-orders.ts
var import_pg_core6 = require("drizzle-orm/pg-core");
var import_drizzle_zod6 = require("drizzle-zod");
var purchaseOrdersTable = (0, import_pg_core6.pgTable)("purchase_orders", {
  id: (0, import_pg_core6.serial)("id").primaryKey(),
  poNumber: (0, import_pg_core6.text)("po_number").notNull().unique(),
  supplierId: (0, import_pg_core6.integer)("supplier_id").notNull().references(() => suppliersTable.id),
  status: (0, import_pg_core6.text)("status").notNull().default("draft"),
  orderDate: (0, import_pg_core6.timestamp)("order_date", { withTimezone: true }),
  expectedDate: (0, import_pg_core6.timestamp)("expected_date", { withTimezone: true }),
  subtotal: (0, import_pg_core6.numeric)("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  total: (0, import_pg_core6.numeric)("total", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: (0, import_pg_core6.text)("notes"),
  createdBy: (0, import_pg_core6.integer)("created_by"),
  approvedBy: (0, import_pg_core6.integer)("approved_by"),
  approvedAt: (0, import_pg_core6.timestamp)("approved_at", { withTimezone: true }),
  createdAt: (0, import_pg_core6.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow()
});
var purchaseOrderLineItemsTable = (0, import_pg_core6.pgTable)("purchase_order_line_items", {
  id: (0, import_pg_core6.serial)("id").primaryKey(),
  purchaseOrderId: (0, import_pg_core6.integer)("purchase_order_id").notNull().references(() => purchaseOrdersTable.id, { onDelete: "cascade" }),
  itemId: (0, import_pg_core6.integer)("item_id").references(() => itemsTable.id, { onDelete: "set null" }),
  description: (0, import_pg_core6.text)("description").notNull(),
  quantity: (0, import_pg_core6.numeric)("quantity", { precision: 12, scale: 2 }).notNull(),
  unitCost: (0, import_pg_core6.numeric)("unit_cost", { precision: 12, scale: 2 }).notNull(),
  lineTotal: (0, import_pg_core6.numeric)("line_total", { precision: 12, scale: 2 }).notNull()
});
var insertPurchaseOrderSchema = (0, import_drizzle_zod6.createInsertSchema)(purchaseOrdersTable).omit({ id: true, createdAt: true });
var insertPurchaseOrderLineItemSchema = (0, import_drizzle_zod6.createInsertSchema)(purchaseOrderLineItemsTable).omit({ id: true });

// src/schema/sales.ts
var import_pg_core7 = require("drizzle-orm/pg-core");
var import_drizzle_zod7 = require("drizzle-zod");
var salesTable = (0, import_pg_core7.pgTable)("sales", {
  id: (0, import_pg_core7.serial)("id").primaryKey(),
  saleNumber: (0, import_pg_core7.text)("sale_number").notNull().unique(),
  paymentMethod: (0, import_pg_core7.text)("payment_method").notNull().default("Cash"),
  subtotal: (0, import_pg_core7.numeric)("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxRate: (0, import_pg_core7.numeric)("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  taxAmount: (0, import_pg_core7.numeric)("tax_amount", { precision: 12, scale: 2 }).notNull(),
  total: (0, import_pg_core7.numeric)("total", { precision: 12, scale: 2 }).notNull(),
  amountTendered: (0, import_pg_core7.numeric)("amount_tendered", { precision: 12, scale: 2 }),
  change: (0, import_pg_core7.numeric)("change", { precision: 12, scale: 2 }),
  notes: (0, import_pg_core7.text)("notes"),
  status: (0, import_pg_core7.text)("status").notNull().default("draft"),
  createdBy: (0, import_pg_core7.integer)("created_by"),
  approvedBy: (0, import_pg_core7.integer)("approved_by"),
  approvedAt: (0, import_pg_core7.timestamp)("approved_at", { withTimezone: true }),
  createdAt: (0, import_pg_core7.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow()
});
var saleLineItemsTable = (0, import_pg_core7.pgTable)("sale_line_items", {
  id: (0, import_pg_core7.serial)("id").primaryKey(),
  saleId: (0, import_pg_core7.integer)("sale_id").notNull().references(() => salesTable.id, { onDelete: "cascade" }),
  itemId: (0, import_pg_core7.integer)("item_id").references(() => itemsTable.id, { onDelete: "set null" }),
  description: (0, import_pg_core7.text)("description").notNull(),
  quantity: (0, import_pg_core7.numeric)("quantity", { precision: 12, scale: 2 }).notNull(),
  unitPrice: (0, import_pg_core7.numeric)("unit_price", { precision: 12, scale: 2 }).notNull(),
  lineTotal: (0, import_pg_core7.numeric)("line_total", { precision: 12, scale: 2 }).notNull()
});
var insertSaleSchema = (0, import_drizzle_zod7.createInsertSchema)(salesTable).omit({ id: true, createdAt: true });
var insertSaleLineItemSchema = (0, import_drizzle_zod7.createInsertSchema)(saleLineItemsTable).omit({ id: true });

// src/schema/users.ts
var import_pg_core8 = require("drizzle-orm/pg-core");
var import_drizzle_zod8 = require("drizzle-zod");
var usersTable = (0, import_pg_core8.pgTable)("users", {
  id: (0, import_pg_core8.serial)("id").primaryKey(),
  username: (0, import_pg_core8.text)("username").notNull().unique(),
  passwordHash: (0, import_pg_core8.text)("password_hash").notNull(),
  role: (0, import_pg_core8.text)("role").notNull().default("inputter"),
  createdAt: (0, import_pg_core8.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow()
});
var insertUserSchema = (0, import_drizzle_zod8.createInsertSchema)(usersTable).omit({ id: true, createdAt: true });
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  customersTable,
  insertCustomerSchema,
  insertInventoryLevelSchema,
  insertInvoiceLineItemSchema,
  insertInvoiceSchema,
  insertItemSchema,
  insertPurchaseOrderLineItemSchema,
  insertPurchaseOrderSchema,
  insertSaleLineItemSchema,
  insertSaleSchema,
  insertStockAdjustmentSchema,
  insertSupplierSchema,
  insertUserSchema,
  inventoryLevelsTable,
  invoiceLineItemsTable,
  invoicesTable,
  itemsTable,
  purchaseOrderLineItemsTable,
  purchaseOrdersTable,
  saleLineItemsTable,
  salesTable,
  stockAdjustmentsTable,
  suppliersTable,
  usersTable
});
