import { config } from "../config.js";
import { runTool } from "../clients/composio.js";
import { appendLogRow } from "../clients/googleSheets.js";
export async function logAndReport(report) {
  const now = new Date().toLocaleString("en-US", { timeZone: config.tz });
  try {
    await appendLogRow({ date: now, artist: report.item?.artist || "", title: report.item?.title || "", type: report.type || "", slug: report.slug || "", mediaId: report.mediaId || "", status: report.status, note: report.note || "" });
  } catch (err) { console.log("sheet log:", err.message); }
  if (!config.adminChannelId) return report;
  const body = [`808 carousel ${now}`, `status: ${report.status}`, report.item ? `${report.item.artist} — ${report.item.title}` : "no article", report.note || "", report.mediaId ? `media ${report.mediaId}` : ""].filter(Boolean).join("\n");
  try { await runTool("DISCORDBOT_SEND_MESSAGE", { channel_id: config.adminChannelId, content: body.slice(0, 1800) }); }
  catch (err) { console.log("discord report:", err.message); }
  return report;
}
