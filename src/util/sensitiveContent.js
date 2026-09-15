// Keyword-based detector for claims of death, violence, or legal/medical
// trouble involving a real person — the category of story where posting a
// second, differently-worded, unconfirmed escalation (e.g. "allegedly shot"
// -> "reportedly shot and killed") about the same artist is a real brand
// risk, not just a duplicate. Deliberately simple/keyword-based rather than
// routed through DeepSeek: it only gates a stricter same-artist dedup
// window (see isAlreadyPosted's `sensitive` param), so a false positive
// just costs an extra skip, while a false negative (missed by DeepSeek's
// own judgment) would silently defeat the safety net entirely.
const SENSITIVE_PATTERN =
  /\b(shot|shooting|killed|kills?|dead|death|di(?:ed|es)|murder(?:ed)?|stabbed|stabbing|arrested|arrest(?:ed)?|hospitali[sz]ed|overdose|assault(?:ed)?|attacked|injured|injury)\b/i;

export function isSensitiveClaim(text) {
  return SENSITIVE_PATTERN.test(text || "");
}
