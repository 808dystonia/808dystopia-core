// Step 3: post a Discord alert, but only when at least one category is
// near or over its limit -- a fine day posts nothing, so the channel only
// ever pings for something that actually needs attention. Gated behind
// config.budgetPublish, same "nothing posts until tested" posture as
// every other pipeline in this repo.
import { config } from "../config.js";
import { postMessage } from "../clients/discord.js";

const STATUS_EMOJI = { over: "\u{1F534}", near: "\u{1F7E1}" };

function formatCategoryLine({ category, spent, monthlyLimit, percent, status }) {
  return `${STATUS_EMOJI[status]} **${category}**: $${spent.toFixed(2)} / $${monthlyLimit.toFixed(2)} (${Math.round(percent * 100)}%)`;
}

function buildEmbed(alertCategories) {
  const anyOver = alertCategories.some((c) => c.status === "over");
  return {
    title: "Budget Alert",
    color: anyOver ? 0xe03131 : 0xf59f00,
    description: alertCategories.map(formatCategoryLine).join("\n"),
    timestamp: new Date().toISOString(),
  };
}

export async function postAlert({ categories }) {
  const alertCategories = categories.filter((c) => c.status === "over" || c.status === "near");

  if (!alertCategories.length) {
    return { published: false, note: "All budgeted categories are under 90% of their limit — nothing to alert on." };
  }

  const embed = buildEmbed(alertCategories);

  if (!config.budgetPublish) {
    return { published: false, note: "BUDGET_PUBLISH is off — dry run, nothing posted.", embed };
  }
  if (!config.discord.budgetChannelId) throw new Error("DISCORD_BUDGET_CHANNEL_ID missing");

  await postMessage(config.discord.budgetChannelId, { embeds: [embed] });
  return { published: true, note: "Posted to budget alert channel" };
}
