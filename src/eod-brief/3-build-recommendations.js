// Step 3: DeepSeek-generated recommendations for STOKELY and FRZA,
// grounded strictly in today's actual accomplishments + analytics —
// never invented suggestions disconnected from what actually happened
// today. Returns an empty array (not generic filler advice) when the
// data genuinely doesn't support a specific recommendation.
import { classifyWithDeepSeek } from "../clients/deepseek.js";

function formatMetrics(metrics) {
  const entries = Object.entries(metrics || {});
  return entries.length ? entries.map(([key, value]) => `${key}: ${value}`).join(", ") : "(no data available)";
}

function buildPrompt(accomplishments, analytics) {
  const accomplishmentsText = accomplishments.length
    ? accomplishments.map((pr) => `- ${pr.title}`).join("\n")
    : "(none today)";

  return `You are a sharp, concise ops advisor for a small underground hip-hop media business (808 Dystopia) run by two people, STOKELY and FRZA. Read today's actual dev accomplishments and social analytics below and return ONLY a JSON object (no markdown, no other text) with this field:

- recommendations: an array of 2-4 short, specific, actionable recommendation strings for STOKELY and FRZA to consider. Ground every recommendation strictly in the data below — never invent facts, numbers, or events not present here. If the data genuinely doesn't support any specific recommendation, return an empty array rather than generic filler advice.

Today's merged dev work:
${accomplishmentsText}

Today's Instagram analytics (@808dystopia):
${formatMetrics(analytics.instagram)}

Today's Pinterest analytics (Underground Hiphop album cover art board and account):
${formatMetrics(analytics.pinterest)}

Return ONLY the JSON object.`;
}

export async function buildRecommendations(accomplishments, analytics) {
  const result = await classifyWithDeepSeek(buildPrompt(accomplishments, analytics));
  return Array.isArray(result.recommendations) ? result.recommendations : [];
}
