function generateRuleBasedInsights(stats) {
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

async function generateDashboardInsights(stats) {
  const fallbackInsights = generateRuleBasedInsights(stats);

  try {
    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({
        model: "llama3.2:1b",
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "You are a business dashboard assistant. Explain all supplied " +
              "statistics, including employees, departments, and invoices. " +
              "Mention total, active, and inactive employees, total departments, " +
              "and total, paid, pending, and overdue invoices. Use only the " +
              "provided numbers. Do not invent data or infer unsupported causes. " +
              "Return 3 to 4 concise sentences.",
          },
          {
            role: "user",
            content: JSON.stringify(stats),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const explanation = data.message?.content?.trim();

    if (!explanation) {
      throw new Error("Ollama returned an empty response");
    }

    return {
      insights: fallbackInsights,
      aiExplanation: explanation,
      aiEnabled: true,
    };
  } catch (error) {
    console.error(
      "Ollama unavailable; using rule-based insights:",
      error.message,
    );

    return {
      insights: fallbackInsights,
      aiExplanation: null,
      aiEnabled: false,
    };
  }
}

module.exports = { generateDashboardInsights };
