import { Router, type IRouter } from "express";
import healthRouter from "./health";
import athleteRouter from "./athlete";
import activitiesRouter from "./activities";
import plansRouter from "./plans";
import alertsRouter from "./alerts";
import dashboardRouter from "./dashboard";
import openaiRouter from "./openai";
import injuriesRouter from "./injuries";
import authRouter from "./auth";
import teamsRouter from "./teams";
import notificationsRouter from "./notifications";
import stravaRouter from "./strava";
import coachPlansRouter from "./coach-plans";
import stripeRouter from "./stripe";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(athleteRouter);
router.use(activitiesRouter);
router.use(plansRouter);
router.use(alertsRouter);
router.use(dashboardRouter);
router.use(openaiRouter);
router.use(injuriesRouter);
router.use(teamsRouter);
router.use(notificationsRouter);
router.use(stravaRouter);
router.use(coachPlansRouter);
router.use(stripeRouter);

export default router;
