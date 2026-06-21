import { Router, type IRouter } from "express";
import healthRouter from "./health";
import athleteRouter from "./athlete";
import activitiesRouter from "./activities";
import plansRouter from "./plans";
import alertsRouter from "./alerts";
import dashboardRouter from "./dashboard";
import openaiRouter from "./openai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(athleteRouter);
router.use(activitiesRouter);
router.use(plansRouter);
router.use(alertsRouter);
router.use(dashboardRouter);
router.use(openaiRouter);

export default router;
