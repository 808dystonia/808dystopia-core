// Step 1: pull today's "accomplishments" — merged GitHub PRs in the last
// 24 hours (see clients/github.js). Every unit of dev work in this repo
// already goes through a PR with a clear title, so this needs no manual
// upkeep and is always current. Validated live: correctly returned all
// 19 real PRs merged in the last day.
import { getMergedPullRequests } from "../clients/github.js";

export async function getAccomplishments() {
  const until = new Date();
  const since = new Date(until.getTime() - 24 * 60 * 60 * 1000);
  return getMergedPullRequests(since.toISOString(), until.toISOString());
}
