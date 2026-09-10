import { config } from "../config.js";
export function buildCaption({ item, type, genius }) {
  const extra = type === "diss" && genius.quote ? `\n\"${genius.quote}\"` : type === "other" ? `\n${item.line}` : "";
  const caption = `${item.line}${extra}\n\nCredit ${item.artist}\nFollow for more.`.trim();
  return { caption: caption.slice(0, 900), comments: config.hashtags };
}
