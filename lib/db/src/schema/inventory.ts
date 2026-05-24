import { pgTable, integer, timestamp, numeric, text, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { itemsTable } from "./items";

export const inventoryLevelsTable = pgTable("inventory_levels", {
  itemId: integer("item_id").primaryKey().references(() => itemsTable.id, { onDelete: "cascade" }),
  quantityOnHand: numeric("quantity_on_hand", { precision: 12, scale: 2 }).notNull().default("0"),
  reorderPoint: numeric("reorder_point", { precision: 12, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const stockAdjustmentsTable = pgTable("stock_adjustments", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => itemsTable.id, { onDelete: "cascade" }),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("draft"),
  createdBy: integer("created_by"),
  approvedBy: integer("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInventoryLevelSchema = createInsertSchema(inventoryLevelsTable).omit({ updatedAt: true });
export type InsertInventoryLevel = z.infer<typeof insertInventoryLevelSchema>;
export type InventoryLevel = typeof inventoryLevelsTable.$inferSelect;

export const insertStockAdjustmentSchema = createInsertSchema(stockAdjustmentsTable).omit({ id: true, createdAt: true });
export type InsertStockAdjustment = z.infer<typeof insertStockAdjustmentSchema>;
export type StockAdjustment = typeof stockAdjustmentsTable.$inferSelect;
