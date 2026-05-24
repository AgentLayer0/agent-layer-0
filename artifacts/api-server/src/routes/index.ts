import { Router, type IRouter } from "express";
import healthRouter from "./health";
import waitlistRouter from "./waitlist";
import adminRouter from "./admin";
import keysRouter from "./keys";
import relayRouter from "./relay";
import governanceRouter from "./governance";
import { billingRouter } from "./billing";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(waitlistRouter);
router.use(adminRouter);
router.use(keysRouter);
router.use(relayRouter);
router.use(governanceRouter);
router.use(billingRouter);
router.use(statsRouter);

export default router;
