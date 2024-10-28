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
    const { fullName, email, password, gender, phoneNumber, role } = req.body;

    if (!fullName || !email || !password || !gender || !phoneNumber || !role) {
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
      role,
      email,
      gender,
      fullName,
      phoneNumber,
      profilePhoto: "",
      verificationCode,
      password: hashPassword,
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
    const { email, password, role } = req.body;

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

    // if role doesn't exist
    if (role !== isUserExist.role) {
      return errorHandler(res, 400, "User doesn't exist with current role");
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
      role: isUserExist.role,
      email: isUserExist.email,
      gender: isUserExist.gender,
      fullName: isUserExist.fullName,
      userName: isUserExist.userName,
      profilePhoto: isUserExist.profilePhoto,
      favouriteContacts: isUserExist.favouriteContacts,
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
    const { search, page = 1, limit = 12 } = req.query;
    let query = {};

    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      };
    }

    const skip = (page - 1) * limit;
    const allUsers = await User.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .select("-password");

    const totalUsers = await User.countDocuments(query);

    return res.status(200).json({
      status: 200,
      message: "Data retrieved successfully",
      data: allUsers,
      pagination: {
        currentPage: page,
        limit: limit,
        totalDocuments: totalUsers,
      },
    });
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

// Forgot Password Controller
export const forgetPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ message: "User with this email does not exist" });
    }

    const resetToken = generateVerificationCode(4);
    const resetTokenExpiration = Date.now() + 3600000;

    // Update user with the reset token and expiration time
    user.resetToken = resetToken;
    user.resetTokenExpiration = resetTokenExpiration;
    await user.save();

    // Send email with the reset code
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset Code",
      html: `<p>Your password reset code is:</p>
             <h3>${resetToken}</h3>
             <p>This code is valid for one hour.</p>`,
    };

    await transporter.sendMail(mailOptions);

    return responseHandler(res, 200, "Reset code has been sent to your email.");
  } catch (error) {
    return errorHandler(res, 500, error.message);
  }
};

// Verify Reset Code Controller
export const verifyResetCode = async (req, res) => {
  try {
    const { email, resetToken } = req.body;

    if (!email || !resetToken) {
      return res
        .status(400)
        .json({ message: "Email and reset code are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (
      user.resetToken !== resetToken ||
      Date.now() > user.resetTokenExpiration
    ) {
      return res.status(400).json({ message: "Invalid or expired reset code" });
    }

    return responseHandler(res, 200, "You can now reset your password.");
  } catch (error) {
    return errorHandler(res, 500, error.message);
  }
};

// Reset Password Controller
export const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (Date.now() > user.resetTokenExpiration) {
      return res.status(400).json({ message: "Invalid or expired reset code" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.resetToken = null;
    user.resetTokenExpiration = null;
    await user.save();

    return responseHandler(res, 200, "Password has been reset successfully.");
  } catch (error) {
    return errorHandler(res, 500, error.message);
  }
};
