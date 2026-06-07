import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const TRIAGE_TOOL = {
  name: "triage_ticket",
  description:
    "Classify, prioritize, and draft a response for a customer support ticket.",
  input_schema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        enum: ["billing", "technical", "account", "feature_request", "general"],
        description: "Primary category of the ticket.",
      },
      priority: {
        type: "string",
        enum: ["low", "medium", "high", "urgent"],
        description:
          "Urgency. 'urgent' = production-down / revenue-impacting / legal risk.",
      },
      sentiment: {
        type: "string",
        enum: ["positive", "neutral", "frustrated", "angry"],
        description: "Customer's emotional tone.",
      },
      assigned_team: {
        type: "string",
        enum: ["billing", "engineering", "success", "product", "support"],
        description: "Team best suited to resolve this.",
      },
      summary: {
        type: "string",
        description: "One-sentence summary of the issue for an agent skimming a queue.",
      },
      suggested_reply: {
        type: "string",
        description:
          "A warm, professional first-response draft an agent can edit and send. 2-4 sentences.",
      },
      confidence: {
        type: "number",
        description: "0-1 confidence in this classification.",
      },
    },
    required: [
      "category",
      "priority",
      "sentiment",
      "assigned_team",
      "summary",
      "suggested_reply",
      "confidence",
    ],
  },
};

export async function triageTicket({ subject, body, customer_email }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    // Offline fallback so the app is demoable without a key
    return mockTriage(subject, body);
  }

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    tools: [TRIAGE_TOOL],
    tool_choice: { type: "tool", name: "triage_ticket" },
    messages: [
      {
        role: "user",
        content: `Triage this support ticket. Be decisive about priority — reserve "urgent" for outages, revenue loss, or legal/financial risk.

Subject: ${subject}
From: ${customer_email}
Body:
${body}`,
      },
    ],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse) throw new Error("Model did not return a triage result");
  return toolUse.input;
}

// Heuristic fallback used when no API key is configured.
function mockTriage(subject, body) {
  const text = `${subject} ${body}`.toLowerCase();
  const urgent = /urgent|down|500|outage|losing revenue|asap|now/.test(text);
  const billing = /charge|refund|invoice|billing|cancel|subscription|fee/.test(text);
  const feature = /feature|request|would love|dark mode|nice to have/.test(text);
  const angry = /frustrat|angry|terrible|unacceptable|immediately/.test(text);

  return {
    category: billing ? "billing" : feature ? "feature_request" : "technical",
    priority: urgent ? "urgent" : billing ? "high" : feature ? "low" : "medium",
    sentiment: angry ? "frustrated" : feature ? "positive" : "neutral",
    assigned_team: billing ? "billing" : feature ? "product" : "engineering",
    summary: subject,
    suggested_reply:
      "Thanks for reaching out — I'm sorry for the trouble and I'm looking into this right away. I'll follow up shortly with an update.",
    confidence: 0.62,
  };
}
