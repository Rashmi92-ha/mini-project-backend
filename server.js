const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const employeeRoutes = require("./routes/employeeRoutes");
const authRoutes = require("./routes/authRoute");
const invoiceRoutes = require("./routes/InvoiceRoutes");
const departmentRoutes = require("./routes/departmentRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

const app = express();

app.use(cors());
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Maximum 100 requests per IP per window
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many requests. Please try again later.",
  },
});

app.use("/employees", apiLimiter);
app.use("/api/auth", apiLimiter);
app.use("/api/invoices", apiLimiter);
app.use("/api/departments", apiLimiter);
app.use("/api/dashboard", apiLimiter);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.log("❌ MongoDB connection error:", err));

app.get("/", (req, res) => {
  res.send("Employee Management app is running!");
});

app.use("/employees", employeeRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/dashboard", dashboardRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
