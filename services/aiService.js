function generateDashboardInsights(stats) {
  const insights = [];

  insights.push(
    `There are ${stats.employees.total} employees: ` +
      `${stats.employees.active} active and ` +
      `${stats.employees.inactive} inactive.`,
  );

  insights.push(`There are ${stats.departments.total} departments.`);

  insights.push(
    `Of ${stats.invoices.total} invoices, ` +
      `${stats.invoices.paid} are paid, ` +
      `${stats.invoices.pending} are pending, and ` +
      `${stats.invoices.overdue} are overdue.`,
  );

  if (stats.invoices.overdue > 0) {
    insights.push(
      `Review the ${stats.invoices.overdue} overdue ` +
        `invoice(s) and follow up as appropriate.`,
    );
  }

  return insights;
}

module.exports = { generateDashboardInsights };
