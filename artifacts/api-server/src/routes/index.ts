import { Router, type IRouter } from "express";
import healthRouter from "./health";
import waitlistRouter from "./waitlist";
import adminRouter from "./admin";
import keysRouter from "./keys";
import relayRouter from "./relay";
import governanceRouter from "./governance";

const router: IRouter = Router();

router.use(healthRouter);
router.use(waitlistRouter);
router.use(adminRouter);
router.use(keysRouter);
router.use(relayRouter);
router.use(governanceRouter);

export default router;
