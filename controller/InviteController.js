// import crypto from "crypto";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { User } from "../model/userModel.js";
import { Invitation } from "../model/invitationModel.js";
import { errorHandler, responseHandler } from "../utils/handler.js";

// Invitation controller
export const sendInvite = async (req, res) => {
  const senderId = req.id;
  const { email, message } = req.body;

  try {
    // Check if the invited user already exists
    const isUserExist = await User.findOne({ email });

    if (isUserExist) {
      const loggedInUser = await User.findById(senderId);

      // Check if the invited user is already a friend
      const isAlreadyFriend = loggedInUser.friends.some(
        (friendId) => friendId.toString() === isUserExist._id.toString()
      );

      if (isAlreadyFriend) {
        return responseHandler(
          res,
          400,
          "User is already in your friends list."
        );
      }

      // Add the registered user to sender's friends list and vice versa
      loggedInUser.friends.push(isUserExist._id);
      await loggedInUser.save();

      isUserExist.friends.push(senderId);
      await isUserExist.save();

      return responseHandler(
        res,
        200,
        "User already registered. Added as a friend."
      );
    }

    // If the user is not registered, send an invite
    const token = crypto.randomBytes(32).toString("hex");

    await Invitation.create({
      senderId,
      email,
      message,
      token,
    });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const inviteLink = `http://localhost:5173/register?inviteToken=${token}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "You're Invited to Join Our Chat App",
      text: `${message}\nClick the link to join: ${inviteLink}`,
    };

    await transporter.sendMail(mailOptions);

    return responseHandler(res, 200, "Invitation sent successfully.");
  } catch (err) {
    console.error(err);
    return errorHandler(res, 500, "Error sending invite.");
  }
};
