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
    const sortField = req.query.sortField || "createdAt";
    const sortOrder =
      req.query.sortOrder === undefined ? -1 : Number(req.query.sortOrder);

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

    const allowedSortFields = [
      "invoiceNumber",
      "supplierName",
      "invoiceDate",
      "amount",
      "tax",
      "createdAt",
    ];

    if (
      !allowedSortFields.includes(sortField) ||
      ![-1, 1].includes(sortOrder)
    ) {
      return res.status(400).json({
        message: "Invalid sort field or sort order.",
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
        .sort({ [sortField]: sortOrder })
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

router.get("/summary", auth, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const [totalInvoices, paidInvoices, pendingInvoices, overdueInvoices] =
      await Promise.all([
        Invoice.countDocuments({ tenantId }),
        Invoice.countDocuments({ tenantId, status: "Paid" }),
        Invoice.countDocuments({ tenantId, status: "Pending" }),
        Invoice.countDocuments({ tenantId, status: "Overdue" }),
      ]);

    return res.status(200).json({
      totalInvoices,
      paidInvoices,
      pendingInvoices,
      overdueInvoices,
    });
  } catch (err) {
    console.error("Invoice summary error:", err);

    return res.status(500).json({
      message: "Failed to fetch invoice summary.",
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

    const updates = {};

    // Validate and prepare only the fields provided.
    if (invoiceNumber !== undefined) {
      if (typeof invoiceNumber !== "string" || !invoiceNumber.trim()) {
        return res.status(400).json({
          message: "Invalid invoice number.",
        });
      }

      updates.invoiceNumber = invoiceNumber.trim();
    }

    if (supplierName !== undefined) {
      if (typeof supplierName !== "string" || !supplierName.trim()) {
        return res.status(400).json({
          message: "Invalid supplier name.",
        });
      }

      updates.supplierName = supplierName.trim();
    }

    if (invoiceDate !== undefined) {
      if (!invoiceDate) {
        return res.status(400).json({
          message: "Invalid invoice date.",
        });
      }

      const parsedInvoiceDate = new Date(invoiceDate);

      if (Number.isNaN(parsedInvoiceDate.getTime())) {
        return res.status(400).json({
          message: "Invalid invoice date.",
        });
      }

      updates.invoiceDate = parsedInvoiceDate;
    }

    if (dueDate !== undefined) {
      if (dueDate === null || dueDate === "") {
        updates.dueDate = null;
      } else {
        const parsedDueDate = new Date(dueDate);

        if (Number.isNaN(parsedDueDate.getTime())) {
          return res.status(400).json({
            message: "Invalid due date.",
          });
        }

        updates.dueDate = parsedDueDate;
      }
    }

    if (amount !== undefined) {
      if (
        typeof amount !== "number" ||
        !Number.isFinite(amount) ||
        amount < 0
      ) {
        return res.status(400).json({
          message: "Amount must be a non-negative number.",
        });
      }

      updates.amount = amount;
    }

    if (tax !== undefined) {
      if (typeof tax !== "number" || !Number.isFinite(tax) || tax < 0) {
        return res.status(400).json({
          message: "Tax must be a non-negative number.",
        });
      }

      updates.tax = tax;
    }

    if (currency !== undefined) {
      if (typeof currency !== "string" || !currency.trim()) {
        return res.status(400).json({
          message: "Invalid currency.",
        });
      }

      updates.currency = currency.trim();
    }

    if (status !== undefined) {
      if (!["Pending", "Paid", "Overdue"].includes(status)) {
        return res.status(400).json({
          message: "Invalid invoice status.",
        });
      }

      updates.status = status;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "Please provide at least one field to update.",
      });
    }

    const updatedInvoice = await Invoice.findOneAndUpdate(
      {
        _id: id,
        tenantId: req.user.tenantId,
      },
      {
        $set: updates,
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

router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid invoice ID.",
      });
    }

    const deletedInvoice = await Invoice.findOneAndDelete({
      _id: id,
      tenantId: req.user.tenantId,
    });

    if (!deletedInvoice) {
      return res.status(404).json({
        message: "Invoice not found.",
      });
    }

    return res.status(200).json({
      message: "Invoice deleted successfully.",
      invoice: deletedInvoice,
    });
  } catch (err) {
    console.error("Delete invoice error:", err);

    return res.status(500).json({
      message: "Failed to delete invoice.",
    });
  }
});

module.exports = router;
