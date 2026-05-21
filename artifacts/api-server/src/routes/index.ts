import { Router, type IRouter } from "express";
import healthRouter from "./health";
import itemsRouter from "./items";
import inventoryRouter from "./inventory";
import customersRouter from "./customers";
import suppliersRouter from "./suppliers";
import invoicesRouter from "./invoices";
import purchaseOrdersRouter from "./purchase-orders";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(itemsRouter);
router.use(inventoryRouter);
router.use(customersRouter);
router.use(suppliersRouter);
router.use(invoicesRouter);
router.use(purchaseOrdersRouter);
router.use(dashboardRouter);

export default router;
