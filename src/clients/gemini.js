// Google Gemini (free tier) — classifies an article and extracts fields.
import { config } from "../config.js";

export async function classifyWithGemini(prompt) {
  const key = config.gemini.apiKey;
  if (!key) throw new Error("GEMINI_API_KEY missing");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`gemini ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  }
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(cleaned);
}
