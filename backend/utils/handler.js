export const errorHandler = (res, code, message) => {
  return res.status(code).json({ message: message });
};

export const responseHandler = (res, code, data, message) => {
  return res.status(code).json({ status: code, message, data: data && data });
};
