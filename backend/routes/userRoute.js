import express from "express";
import {
  deleteUser,
  getAllUsers,
  getUserById,
  login,
  logout,
  register,
  updateUser,
  forgetPassword,
  verifyResetCode,
  resetPassword,
} from "../controller/userController.js";
import isAuthenticated from "../middleware/isAuthenticated.js";
import { singleUpload } from "../middleware/multer.js";

const router = express.Router();

router.route("/register").post(register);
router.route("/login").post(login);
router.route("/logout").get(logout);
router.route("/delete-user/:id").delete(deleteUser);
router.route("/user").get(isAuthenticated, getAllUsers);
router.route("/user/:id").get(isAuthenticated, getUserById);
router.route("/user/forget-password").post(isAuthenticated, forgetPassword);
router.route("/update-user/:id").put(isAuthenticated, singleUpload, updateUser);
router.route("/reset-code").post(verifyResetCode);
router.route("/reset-password").post(resetPassword);

export default router;
