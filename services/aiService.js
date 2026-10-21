const { GoogleGenAI } = require("@google/genai");

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
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const response = await ai.interactions.create({
      model: "gemini-3.8-flash",
      input:
        "Explain these dashboard statistics in 3 to 4 concise sentences. " +
        "Cover employees, departments, and invoices. Use only the supplied " +
        "numbers. Do not invent data or infer unsupported causes.\n\n" +
        JSON.stringify(stats),
    });

    const explanation = response.output_text?.trim();

    if (!explanation) {
      throw new Error("Gemini returned an empty response");
    }

    return {
      insights: fallbackInsights,
      aiExplanation: explanation,
      aiEnabled: true,
    };
  } catch (error) {
    console.error(
      "Gemini unavailable; using rule-based insights:",
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
