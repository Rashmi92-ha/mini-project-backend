const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Department = require("../models/department");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

router.use(auth);

// GET: Fetch departments belonging to the logged-in tenant
router.get("/", async (req, res) => {
  try {
    const departments = await Department.find({
      tenantId: req.user.tenantId,
    }).sort({ name: 1 });

    res.status(200).json(departments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET: Fetch one department
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid department ID" });
    }

    const department = await Department.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    });

    if (!department) {
      return res.status(404).json({ message: "Department not found" });
    }

    res.status(200).json(department);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST: Create a department (admin only)
router.post("/", admin, async (req, res) => {
  try {
    const name = req.body.name?.trim();
    const description = req.body.description?.trim() || "";

    if (!name) {
      return res.status(400).json({
        message: "Department name is required",
      });
    }

    if (name.length > 100 || description.length > 500) {
      return res.status(400).json({
        message: "Department name or description exceeds the allowed length",
      });
    }

    const department = await Department.create({
      name,
      description,
      tenantId: req.user.tenantId,
    });

    res.status(201).json(department);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        message: "A department with this name already exists",
      });
    }

    res.status(500).json({ message: err.message });
  }
});

// PUT: Update a department (admin only)
router.put("/:id", admin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid department ID" });
    }

    const updates = {};

    if (req.body.name !== undefined) {
      const name = req.body.name?.trim();

      if (!name || name.length > 100) {
        return res.status(400).json({
          message:
            "Department name is required and must not exceed 100 characters",
        });
      }

      updates.name = name;
    }

    if (req.body.description !== undefined) {
      const description = req.body.description?.trim() || "";

      if (description.length > 500) {
        return res.status(400).json({
          message: "Description must not exceed 500 characters",
        });
      }

      updates.description = description;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "Provide a department name or description to update",
      });
    }

    const department = await Department.findOneAndUpdate(
      {
        _id: req.params.id,
        tenantId: req.user.tenantId,
      },
      { $set: updates },
      { new: true, runValidators: true },
    );

    if (!department) {
      return res.status(404).json({ message: "Department not found" });
    }

    res.status(200).json(department);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        message: "A department with this name already exists",
      });
    }

    res.status(400).json({ message: err.message });
  }
});

// DELETE: Delete a department (admin only)
router.delete("/:id", admin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid department ID" });
    }

    const department = await Department.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    });

    if (!department) {
      return res.status(404).json({ message: "Department not found" });
    }

    res.status(200).json({
      message: "Department deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
