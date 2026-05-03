import { Router, type IRouter } from "express";
import healthRouter from "./health";
import patientsRouter from "./patients";
import staffRouter from "./staff";
import notificationsRouter from "./notifications";
import auditRouter from "./audit";
import sinanNotificationsRouter from "./sinan-notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/patients", patientsRouter);
router.use("/patients/:id/notifications", notificationsRouter);
router.use("/staff", staffRouter);
router.use("/audit", auditRouter);
router.use("/notifications", sinanNotificationsRouter);

export default router;
