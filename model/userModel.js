import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
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

    role: {
      type: String,
      enum: ["patient", "doctor"],
      default: "patient",
    },
    resetToken: { type: String, default: null },
    resetTokenExpiration: { type: Date, default: null },
  },
  { timestamps: true }
);

export const User = new mongoose.model("User", userSchema);
