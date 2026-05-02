import { Router, type IRouter } from "express";
import healthRouter from "./health";
import patientsRouter from "./patients";
import staffRouter from "./staff";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/patients", patientsRouter);
router.use("/patients/:id/notifications", notificationsRouter);
router.use("/staff", staffRouter);

export default router;
