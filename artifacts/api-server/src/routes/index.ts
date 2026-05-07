import { Router, type IRouter } from "express";
import healthRouter from "./health";
import patientsRouter from "./patients";
import staffRouter from "./staff";
import notificationsRouter from "./notifications";
import auditRouter from "./audit";
import sinanNotificationsRouter from "./sinan-notifications";
import authRouter from "./auth";
import socialNotesRouter from "./social-notes";
import nutritionalAssessmentsRouter from "./nutritional-assessments";
import pharmacyEntriesRouter from "./pharmacy-entries";
import transfersRouter from "./transfers";
import alertsRouter from "./alerts";
import bedsRouter from "./beds";
import devicesRouter from "./devices";
import backupRouter from "./backup";
import examRequestsRouter from "./exam-requests";
import patientAlertsRouter from "./patient-alerts";
import callsRouter from "./calls";
import { requireAuth } from "../middleware/require-auth";
import { auditWrite } from "../middleware/audit-write";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/calls", callsRouter);  // public GET /recent + auth POST /

router.use(requireAuth);
router.use(auditWrite);

router.use("/patients", patientsRouter);
router.use("/exam-requests", examRequestsRouter);
router.use("/patients/:id/notifications", notificationsRouter);
router.use("/patients/:id/social-notes", socialNotesRouter);
router.use("/patients/:id/nutritional-assessments", nutritionalAssessmentsRouter);
router.use("/patients/:id/pharmacy-entries", pharmacyEntriesRouter);
router.use("/patients/:id/transfers", transfersRouter);
router.use("/patients/:id/devices", devicesRouter);
router.use("/patients/:id/alerts", patientAlertsRouter);
router.use("/backup", backupRouter);
router.use("/staff", staffRouter);
router.use("/audit", auditRouter);
router.use("/alerts", alertsRouter);
router.use("/beds", bedsRouter);
router.use("/notifications", sinanNotificationsRouter);

export default router;
