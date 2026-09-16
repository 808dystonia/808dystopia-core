// Step 2: sum this month's expenses per category and compare each against
// its Budget-tab limit. A category with spending but no limit row is
// reported separately as "unbudgeted" (so it's still visible) rather than
// silently dropped -- but it never triggers an alert, since there's no
// limit to be near or over.
const NEAR_THRESHOLD = 0.9; // 90% of the limit counts as "near"

export function computeStatus({ thisMonthRows, limits }) {
  const spentByCategory = new Map(); // normalized key -> { category, spent }
  for (const row of thisMonthRows) {
    if (row.type !== "expense") continue;
    const category = row.category.trim();
    if (!category) continue;

    const key = category.toLowerCase();
    const existing = spentByCategory.get(key);
    if (existing) existing.spent += row.amount;
    else spentByCategory.set(key, { category, spent: row.amount });
  }

  const categories = limits
    .filter((limit) => limit.category.trim())
    .map((limit) => {
      const key = limit.category.trim().toLowerCase();
      const spent = spentByCategory.get(key)?.spent || 0;
      spentByCategory.delete(key);

      const percent = limit.monthlyLimit > 0 ? spent / limit.monthlyLimit : 0;
      const status = percent >= 1 ? "over" : percent >= NEAR_THRESHOLD ? "near" : "ok";
      return { category: limit.category.trim(), spent, monthlyLimit: limit.monthlyLimit, percent, status };
    });

  // Whatever's left in the map had spending this month but no matching
  // Budget row.
  const unbudgeted = [...spentByCategory.values()];

  return { categories, unbudgeted };
}
