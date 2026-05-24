import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import itemsRouter from "./items";
import inventoryRouter from "./inventory";
import customersRouter from "./customers";
import suppliersRouter from "./suppliers";
import invoicesRouter from "./invoices";
import purchaseOrdersRouter from "./purchase-orders";
import dashboardRouter from "./dashboard";
import posRouter from "./pos";
import reportsRouter from "./reports";
import usersRouter from "./users";
import { requireAuth, requireRole } from "../lib/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);

router.use(requireAuth);

router.use(itemsRouter);
router.use(inventoryRouter);
router.use(customersRouter);
router.use(suppliersRouter);
router.use(dashboardRouter);
router.use(posRouter);

router.use(requireRole("approver", "admin"), invoicesRouter);
router.use(requireRole("approver", "admin"), purchaseOrdersRouter);
router.use(requireRole("approver", "admin"), reportsRouter);
router.use(usersRouter);

export default router;
