import { Router, type IRouter } from "express";
import healthRouter from "./health";
import patientsRouter from "./patients";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/patients", patientsRouter);

export default router;
