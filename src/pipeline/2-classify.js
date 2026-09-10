import { classifyWithGemini } from "../clients/gemini.js";

export async function classifyArticle(item) {
  const data = await classifyWithGemini(`Classify this underground rap news item.\nReturn JSON only:\n{\"type\":\"album\"|\"diss\"|\"other\",\"reason\":\"short\",\"hook\":\"DROPS \\"TITLE\\" style hook\"}\nRules:\n- album = album, EP, mixtape, tape, project with multiple tracks\n- diss = beef, diss, response track aimed at another artist\n- other = single, video, co-sign, festival, show, anything else\nNever invent facts.\n\nARTIST: ${item.artist}\nTITLE: ${item.title}\nLINE: ${item.line}`);
  const type = ["album", "diss", "other"].includes(data.type) ? data.type : "other";
  return { type, reason: data.reason || "", hook: data.hook || `DROPS \"${item.title}\"` };
}
