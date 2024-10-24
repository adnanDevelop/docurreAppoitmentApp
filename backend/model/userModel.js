import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    userName: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    phoneNumber: {
      type: String,
    },
    password: {
      type: String,
      required: true,
    },
    aboutProfile: {
      type: String,
    },
    profilePhoto: {
      type: String,
      default: "",
    },
    gender: {
      type: String,
      enum: ["male", "female"],
      default: "male",
    },
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    resetToken: { type: String, default: null },
    resetTokenExpiration: { type: Date, default: null },
    // isVerified: { type: Boolean, default: false },
    verificationExpiration: { type: String },
    verificationCode: { type: String },
  },
  { timestamps: true }
);

export const User = new mongoose.model("User", userSchema);
