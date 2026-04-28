const success = (res, data, status = 200) =>
  res.status(status).json({ success: true, data, error: null });

const error = (res, message, status = 500) =>
  res.status(status).json({ success: false, data: null, error: message });

module.exports = { success, error };
