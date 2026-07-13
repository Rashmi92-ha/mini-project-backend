const express = require("express");
const router = express.Router();
const Employee = require("../models/employee");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

router.use(auth);

router.get("/", async (req, res) => {
  try {
    const employees = await Employee.find({
      tenantId: req.user.tenantId,
    });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }
    res.json(employee);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", admin, async (req, res) => {
  const employee = new Employee({
    name: req.body.name,
    email: req.body.email,
    department: req.body.department,
    role: req.body.role,
    salary: req.body.salary,
    status: req.body.status,
    tenantId: req.user.tenantId,
  });

  try {
    const newEmployee = await employee.save();
    res.status(201).json(newEmployee);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/:id", admin, async (req, res) => {
  try {
    const updatedEmployee = await Employee.findOneAndUpdate(
      {
        _id: req.params.id,
        tenantId: req.user.tenantId,
      },
      req.body,
      { new: true },
    );
    if (!updatedEmployee) {
      return res.status(404).json({ message: "Employee not found" });
    }
    res.json(updatedEmployee);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id",admin, async (req, res) => {
  try {
    const deletedEmployee = await Employee.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    });
    if (!deletedEmployee) {
      return res.status(404).json({ message: "Employee not found" });
    }
    res.json({ message: "Employee deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
