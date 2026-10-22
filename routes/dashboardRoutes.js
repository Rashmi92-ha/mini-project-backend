const express = require("express");
const auth = require("../middleware/auth");
const { redisClient } = require("../config/redisClient");
const Employee = require("../models/employee");
const Invoice = require("../models/Invoice");
const Department = require("../models/department");
const { generateDashboardInsights } = require("../services/aiService");

const router = express.Router();

router.get("/insights", auth, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const cacheKey = `dashboard:insights:${tenantId}`;

    // 1. Check Redis cache first
    if (redisClient.isReady) {
      try {
        const cachedData = await redisClient.get(cacheKey);

        if (cachedData) {
          console.log("Redis cache HIT");
          return res.status(200).json(JSON.parse(cachedData));
        }

        console.log("Redis cache MISS");
      } catch (cacheError) {
        console.error("Redis cache read failed:", cacheError.message);
      }
    }

    // 2. Fetch dashboard statistics from MongoDB
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

    // 3. Generate AI insights, with rule-based fallback
    const result = await generateDashboardInsights(stats);

    const responseData = {
      stats,
      insights: result.insights,
      aiExplanation: result.aiExplanation,
      aiEnabled: result.aiEnabled,
    };

    // 4. Save response to Redis for 60 seconds
    if (redisClient.isReady) {
      try {
        await redisClient.set(cacheKey, JSON.stringify(responseData), {
          EX: 60,
        });

        console.log("Redis cache saved successfully");
      } catch (cacheError) {
        console.error("Redis cache save failed:", cacheError.message);
      }
    }

    // 5. Return the dashboard response
    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Dashboard insights error:", error.message);

    return res.status(500).json({
      message: "Unable to generate dashboard insights.",
    });
  }
});

module.exports = router;
