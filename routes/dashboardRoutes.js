const express = require("express");
const auth = require("../middleware/auth");
const Employee = require("../models/employee");
const Invoice = require("../models/Invoice");
const Department = require("../models/department");
const { generateDashboardInsights } = require("../services/aiService");

const router = express.Router();

router.get("/insights", auth, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const [
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      totalDepartments,
      totalInvoices,
      paidInvoices,
      pendingInvoices,
      overdueInvoices,
    ] = await Promise.all([
      Employee.countDocuments({ tenantId }),
      Employee.countDocuments({ tenantId, status: "Active" }),
      Employee.countDocuments({ tenantId, status: "Inactive" }),
      Department.countDocuments({ tenantId }),
      Invoice.countDocuments({ tenantId }),
      Invoice.countDocuments({ tenantId, status: "Paid" }),
      Invoice.countDocuments({ tenantId, status: "Pending" }),
      Invoice.countDocuments({ tenantId, status: "Overdue" }),
    ]);

    const stats = {
      employees: {
        total: totalEmployees,
        active: activeEmployees,
        inactive: inactiveEmployees,
      },
      departments: {
        total: totalDepartments,
      },
      invoices: {
        total: totalInvoices,
        paid: paidInvoices,
        pending: pendingInvoices,
        overdue: overdueInvoices,
      },
    };

    const insights = await generateDashboardInsights(stats);

    return res.status(200).json({ stats, insights });
  } catch (error) {
    console.error("Dashboard insights error:", error.message);

    return res.status(500).json({
      message: "Unable to generate dashboard insights.",
    });
  }
});

module.exports = router;
