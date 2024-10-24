import multer from "multer";

const storage = multer.memoryStorage();
export const upload = multer({ storage });

export const singleUpload = upload.fields([
  { name: "profilePhoto", maxCount: 1 },
]);
