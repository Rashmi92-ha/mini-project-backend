const express = require("express");
const mongoose = require("mongoose");
const Invoice = require("../models/Invoice");
const auth = require("../middleware/auth");

const router = express.Router();

// Create an invoice
router.post("/", auth, async (req, res) => {
  try {
    const {
      invoiceNumber,
      supplierName,
      invoiceDate,
      dueDate,
      amount,
      tax,
      currency,
      status,
    } = req.body;

    if (
      typeof invoiceNumber !== "string" ||
      !invoiceNumber.trim() ||
      typeof supplierName !== "string" ||
      !supplierName.trim() ||
      !invoiceDate ||
      amount === undefined ||
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      return res.status(400).json({
        message: "Please provide valid required invoice fields.",
      });
    }

    if (tax !== undefined && (!Number.isFinite(tax) || tax < 0)) {
      return res.status(400).json({
        message: "Tax must be a non-negative number.",
      });
    }

    if (
      status !== undefined &&
      !["Pending", "Paid", "Overdue"].includes(status)
    ) {
      return res.status(400).json({
        message: "Invalid invoice status.",
      });
    }

    const parsedInvoiceDate = new Date(invoiceDate);

    if (Number.isNaN(parsedInvoiceDate.getTime())) {
      return res.status(400).json({
        message: "Invalid invoice date.",
      });
    }

    let parsedDueDate;

    if (dueDate) {
      parsedDueDate = new Date(dueDate);

      if (Number.isNaN(parsedDueDate.getTime())) {
        return res.status(400).json({
          message: "Invalid due date.",
        });
      }
    }

    const invoice = await Invoice.create({
      invoiceNumber: invoiceNumber.trim(),
      supplierName: supplierName.trim(),
      invoiceDate: parsedInvoiceDate,
      dueDate: parsedDueDate,
      amount,
      tax: tax ?? 0,
      currency: currency ?? "INR",
      status: status ?? "Pending",
      tenantId: req.user.tenantId,
    });

    return res.status(201).json(invoice);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        message: "Invoice number already exists for this company.",
      });
    }

    if (err.name === "ValidationError") {
      return res.status(400).json({
        message: err.message,
      });
    }

    return res.status(500).json({
      message: "Failed to create invoice.",
    });
  }
});

// List invoices for the authenticated tenant
router.get("/", auth, async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Number.parseInt(req.query.limit, 10) || 10;
    const search = (req.query.search || "").trim();
    const status = req.query.status;

    if (
      !Number.isSafeInteger(page) ||
      !Number.isSafeInteger(limit) ||
      page < 1 ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        message: "Page must be positive and limit must be between 1 and 100.",
      });
    }

    const filter = {
      tenantId: req.user.tenantId,
    };

    // Search by invoice number or supplier name
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      filter.$or = [
        { invoiceNumber: { $regex: escapedSearch, $options: "i" } },
        { supplierName: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    // Filter by invoice status
    const allowedStatuses = ["Pending", "Paid", "Overdue"];

    if (status && status !== "All") {
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          message: "Invalid invoice status.",
        });
      }

      filter.status = status;
    }

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(filter),
    ]);

    return res.status(200).json({
      invoices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Failed to fetch invoices:", err);
    return res.status(500).json({
      message: "Failed to fetch invoices.",
    });
  }
});

// Get one invoice belonging to the authenticated tenant
router.get("/:id", auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid invoice ID.",
      });
    }

    const invoice = await Invoice.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    }).lean();

    if (!invoice) {
      return res.status(404).json({
        message: "Invoice not found.",
      });
    }

    return res.status(200).json(invoice);
  } catch (err) {
    return res.status(500).json({
      message: "Failed to fetch invoice.",
    });
  }
});

/* Update an existing invoice */
router.put("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid invoice ID.",
      });
    }

    const {
      invoiceNumber,
      supplierName,
      invoiceDate,
      dueDate,
      amount,
      tax,
      currency,
      status,
    } = req.body;

    // Validate required fields
    if (
      typeof invoiceNumber !== "string" ||
      !invoiceNumber.trim() ||
      typeof supplierName !== "string" ||
      !supplierName.trim() ||
      !invoiceDate ||
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      return res.status(400).json({
        message: "Please provide valid required invoice fields.",
      });
    }

    if (tax !== undefined && (!Number.isFinite(tax) || tax < 0)) {
      return res.status(400).json({
        message: "Tax must be a non-negative number.",
      });
    }

    if (
      status !== undefined &&
      !["Pending", "Paid", "Overdue"].includes(status)
    ) {
      return res.status(400).json({
        message: "Invalid invoice status.",
      });
    }

    const parsedInvoiceDate = new Date(invoiceDate);

    if (Number.isNaN(parsedInvoiceDate.getTime())) {
      return res.status(400).json({
        message: "Invalid invoice date.",
      });
    }

    let parsedDueDate = null;

    if (dueDate) {
      parsedDueDate = new Date(dueDate);

      if (Number.isNaN(parsedDueDate.getTime())) {
        return res.status(400).json({
          message: "Invalid due date.",
        });
      }
    }

    const updatedInvoice = await Invoice.findOneAndUpdate(
      {
        _id: id,
        tenantId: req.user.tenantId,
      },
      {
        $set: {
          invoiceNumber: invoiceNumber.trim(),
          supplierName: supplierName.trim(),
          invoiceDate: parsedInvoiceDate,
          dueDate: parsedDueDate,
          amount,
          tax: tax ?? 0,
          currency: currency ?? "INR",
          status: status ?? "Pending",
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updatedInvoice) {
      return res.status(404).json({
        message: "Invoice not found.",
      });
    }

    return res.status(200).json(updatedInvoice);
  } catch (err) {
    console.error("Update invoice error:", err);

    if (err.code === 11000) {
      return res.status(409).json({
        message: "Invoice number already exists for this company.",
      });
    }

    if (err.name === "ValidationError") {
      return res.status(400).json({
        message: err.message,
      });
    }

    return res.status(500).json({
      message: "Failed to update invoice.",
    });
  }
});
module.exports = router;
