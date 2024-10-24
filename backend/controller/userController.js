import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { User } from "../model/userModel.js";
import { errorHandler, responseHandler } from "../utils/handler.js";
import { generateVerificationCode } from "../utils/verificationCode.js";
import getDataUri from "../middleware/datauri.js";
import cloudinary from "../middleware/cloudinary.js";
cloudinary.config();

// Register Controller
export const register = async (req, res) => {
  try {
    const { fullName, email, password, gender, phoneNumber } = req.body;

    if (!fullName || !email || !password || !gender || !phoneNumber) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    const hashPassword = await bcrypt.hash(password, 10);

    // Generating unique token
    const verificationCode = generateVerificationCode(6);
    const verificationExpiration = Date.now() + 3600000;

    const data = await User.create({
      fullName,
      email,
      password: hashPassword,
      gender,
      phoneNumber,
      profilePhoto: "",
      verificationCode,
      verificationExpiration,
    });

    // Send verification email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const verifyUrl = `http://yourfrontend.com/verify-email/${verificationCode}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Verify your email address",
      html: `<p>Please click the link below to verify your email address:</p>
             <a href="${verifyUrl}">Verify Email</a>`,
    };

    await transporter.sendMail(mailOptions);

    const userData = {
      _id: data._id,
      email: data.email,
      fullName: data.fullName,
      userName: data.userName,
      phoneNumber: data.phoneNumber,
      profilePhoto: data.profilePhoto,
      gender: data.gender,
      isVerified: data.isVerified,
    };

    return responseHandler(
      res,
      200,
      userData,
      // "User created successfully. A verification email has been sent."
      "User created successfully."
    );
  } catch (error) {
    return errorHandler(res, 400, error.message);
  }
};

// Login Controller
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const isUserExist = await User.findOne({ email });
    if (!isUserExist) {
      return res.status(404).json({ message: "Invalid email address" });
    }

    const comparePassword = await bcrypt.compare(
      password,
      isUserExist.password
    );

    if (!comparePassword) {
      return res.status(404).json({ message: "Invalid password" });
    }

    // generate token
    const generateToken = jwt.sign(
      {
        userId: isUserExist._id,
      },
      process.env.SECRET_KEY,
      { expiresIn: "1d" }
    );

    const userData = {
      _id: isUserExist._id,
      fullName: isUserExist.fullName,
      userName: isUserExist.userName,
      email: isUserExist.email,
      profilePhoto: isUserExist.profilePhoto,
      gender: isUserExist.gender,
      favouriteContacts: isUserExist.favouriteContacts,
      friends: isUserExist.friends,
    };

    // login user
    return res
      .status(200)
      .cookie("token", generateToken, {
        maxAge: 1 * 24 * 60 * 60 * 1000,
        httpsOnly: true,
        sameSite: "strict",
      })
      .json({
        message: `Welcome back ${isUserExist?.fullName}`,
        data: userData,
        status_code: 200,
      });
  } catch (error) {
    console.log(error, "Error while loging user");
    return errorHandler(res, 400, error.message);
  }
};

// Update user
export const updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const files = req.files;
    let profilePhotoUrl;
    const { fullName, email, aboutProfile } = req.body;

    // Upload profile photo to Cloudinary if it exists
    if (files.profilePhoto && files.profilePhoto.length > 0) {
      const profilePhotoUri = getDataUri(files.profilePhoto[0]);
      const cloudinaryResponse = await cloudinary.uploader.upload(
        profilePhotoUri.content
      );
      profilePhotoUrl = cloudinaryResponse.secure_url;
    }

    const findUser = await User.findById({ _id: userId });

    if (email) findUser.email = email;
    if (fullName) findUser.fullName = fullName;
    if (aboutProfile) findUser.aboutProfile = aboutProfile;
    if (profilePhotoUrl) findUser.profilePhoto = profilePhotoUrl;

    await findUser.save();

    const userData = {
      _id: findUser._id,
      email: findUser.email,
      fullName: findUser.fullName,
      profilePhoto: findUser.profilePhoto,
      aboutProfile: findUser.aboutProfile,
    };

    return responseHandler(res, 200, userData, "User updated successfully");
  } catch (error) {
    return errorHandler(res, 400, error.message);
  }
};

// Delete User Controller
export const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const deleteUser = await User.deleteOne({ _id: userId });
    if (deleteUser.deletedCount !== 1) {
      return errorHandler(res, 400, "User not deleted");
    } else {
      return responseHandler(res, 200, "User deleted successfully");
    }
  } catch (error) {
    return errorHandler(res, 400, error.message);
  }
};

// Logout Controller
export const logout = async (req, res) => {
  try {
    return res
      .status(200)
      .cookie("token", "", { maxAge: 0 })
      .json({ message: "Logout successfully", status: 200 });
  } catch (error) {
    console.log("error while logout user", error.message);
    return errorHandler(res, 400, error.message);
  }
};

// Get all User except login user
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select("-password");
    return responseHandler(res, 200, users, "Data retreived successfully");
  } catch (error) {
    return errorHandler(res, 400, error.message);
  }
};

// Get User by id
export const getUserById = async (req, res) => {
  try {
    const userId = req.params.id;
    const { search } = req.query;
    const findUser = await User.findById({ _id: userId }).select("-password");

    if (!findUser) {
      return errorHandler(res, 404, "User not found");
    }

    return responseHandler(res, 200, findUser, "Data retreived successfully");
  } catch (error) {
    return errorHandler(res, 400, error.message);
  }
};

// Password reset request controller
export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return errorHandler(res, 404, "User not found");
    }

    // Token generate karna
    const token = jwt.sign({ userId: user._id }, process.env.SECRET_KEY, {
      expiresIn: "1h",
    });

    user.resetToken = token;
    user.resetTokenExpiration = Date.now() + 3600000; // 1 hour
    await user.save();

    // Sending Email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const resetUrl = `http://yourfrontend.com/reset-password/${token}`;
    console.log(resetUrl, "resetUrl", email);
    const maleOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset",
      html: `<p>To reset your password, click the link below:</p>
             <a href="${resetUrl}">Reset Password</a>`,
    };

    await transporter.sendMail(maleOptions);
    return responseHandler(res, 200, "Password reset link sent to your email");
  } catch (error) {
    return errorHandler(res, 400, error.message);
  }
};

// Password reset response controller
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiration: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetToken = null;
    user.resetTokenExpiration = null;
    await user.save();

    return responseHandler(res, 200, "Password reset successfully");
  } catch (error) {
    return errorHandler(res, 400, error.message);
  }
};

// Update password controller
export const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.id;

    const user = await User.findById(userId);
    const comparePassword = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!comparePassword) {
      return errorHandler(res, 400, "Password does not match");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    return responseHandler(res, 200, "Password updated successfully");
  } catch (error) {
    return errorHandler(res, 400, error.message);
  }
};

// Email Verification Controller
export const verifyEmail = async (req, res) => {
  try {
    const { code } = req.body;

    const user = await User.findOne({
      verificationCode: code,
      verificationExpiration: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired verification token." });
    }

    user.verificationCode = code;
    user.verificationExpiration = null;
    user.isVerified = true;
    await user.save();

    return responseHandler(res, 200, "Email verified successfully.");
  } catch (error) {
    return errorHandler(res, 400, error.message);
  }
};
