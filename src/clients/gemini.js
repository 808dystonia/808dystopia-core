import { config } from "../config.js";

export async function classifyWithGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`gemini ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return JSON.parse(text);
}
