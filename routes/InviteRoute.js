import express from "express";
const router = express.Router();

import { sendInvite } from "../controller/InviteController.js";
import isAuthenticated from "../middleware/isAuthenticated.js";

router.route("/sent").post(isAuthenticated, sendInvite);

export default router;
