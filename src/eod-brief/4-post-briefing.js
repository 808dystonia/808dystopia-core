// Step 4: format the day's accomplishments + analytics + recommendations
// into a Discord embed and post to #admin-general. Gated behind
// config.eodBriefPublish, same "nothing posts until tested" posture as
// the other two pipelines' publish gates — lower stakes here (a private
// admin channel, not a public account) but kept consistent.
import { config } from "../config.js";
import { postToAdminChannel } from "../clients/discord.js";

const METRIC_LABELS = {
  reach: "Reach",
  accounts_engaged: "Accounts engaged",
  total_interactions: "Total interactions",
  likes: "Likes",
  comments: "Comments",
  shares: "Shares",
  saves: "Saves",
  profile_views: "Profile views",
  follower_count: "New followers",
};

function formatAnalyticsField(instagram) {
  const lines = Object.entries(METRIC_LABELS)
    .filter(([key]) => instagram[key] != null)
    .map(([key, label]) => `${label}: ${instagram[key]}`);
  return lines.length
    ? lines.join("\n")
    : "No data available yet (small/new account — some metrics need 100+ followers or actual activity in the window).";
}

function buildEmbed({ accomplishments, analytics, recommendations }) {
  return {
    title: "808 Dystopia — EOD Brief",
    color: 0x8a2be2,
    fields: [
      {
        name: `Accomplishments (${accomplishments.length})`,
        value: (accomplishments.length
          ? accomplishments.map((pr) => `[#${pr.number}](${pr.url}) ${pr.title}`).join("\n")
          : "No dev work merged today."
        ).slice(0, 1024),
      },
      {
        name: "Instagram (@808dystopia)",
        value: formatAnalyticsField(analytics.instagram).slice(0, 1024),
      },
      {
        name: "Recommendations",
        value: (recommendations.length ? recommendations.map((r) => `• ${r}`).join("\n") : "Nothing specific today.").slice(
          0,
          1024
        ),
      },
    ],
    timestamp: new Date().toISOString(),
  };
}

export async function postBriefing({ accomplishments, analytics, recommendations }) {
  const embed = buildEmbed({ accomplishments, analytics, recommendations });

  if (!config.eodBriefPublish) {
    return { published: false, note: "EOD_BRIEF_PUBLISH is off — dry run, nothing posted.", embed };
  }

  await postToAdminChannel({ embeds: [embed] });
  return { published: true, note: "Posted to #admin-general" };
}
