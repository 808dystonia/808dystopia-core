# 808 Dystopia Automation

GitHub Actions pipelines for 808 Dystopia's Instagram, Facebook, Pinterest, Discord, and website. All business schedules use America/Chicago with DST-aware gates.

Active pipelines: news carousel, Reel, album-art Pinterest pins, His/Her Underground artist Pinterest pins, News Brief, EOD Brief, Morning Sync, and Trending Tuesday. RapToonz, BoxArt, and TikTok publishing are discontinued. TikTok links can still supply source clips for Reels.

## Setup and development

Requires Node 22. Copy `.env.example` to `.env` for local configuration. Never commit credentials. Production credentials live in GitHub Actions secrets.

```bash
npm ci --ignore-scripts
npm test
npm run check
```

Publish flags default off locally. Do not trigger live publishing to test changes. Read [AGENTS.md](AGENTS.md) before editing and [the operations guide](docs/operations.md) before changing scheduling, state, or publishing.

## Reliability and observability

- Time-window checks run before expensive dependency setup.
- Per-pipeline concurrency, durable slot records, and content claims prevent duplicate attempts.
- Confirmed platform IDs survive comment, cross-post, or Sheets failures.
- Automation Health flags overdue or incomplete slots in GitHub Actions.
- `npm run dashboard` exports current targets and verified per-platform outcomes.
- Weekly Performance reports compare artists, topics, formats, and Chicago posting hours using measured metrics and explicit sample counts.

Durable non-secret runtime metadata lives on the separate `automation-state` branch. Existing published media remains in `public-media/`. Google Sheets preserves historical outcome logs. See the operations guide for recovery when a publish response is uncertain.

## Text generation

DeepSeek remains the default for classification, digest selection, highlights, and recommendations. OpenAI is an optional configurable alternative using Responses and Structured Outputs. It requires an Actions secret `OPENAI_API_KEY` and variables `OPENAI_MODEL` and `AI_PROVIDER=openai`; adding code alone does not activate it.

Gemini is a free alternative (Google AI Studio free tier, no card). Create a key at aistudio.google.com, add it as the Actions secret `GEMINI_API_KEY`, and set the Actions variable `AI_PROVIDER=gemini`. The model defaults to `gemini-flash-lite-latest`; override with the variable `GEMINI_MODEL`. Free-tier limits are per day and Google may change them; the pipelines make well under 100 calls a day.

## Project rules

Use real photos and source-backed facts for active news publishing. Do not repeat posted stories or clips. Preserve sensitive-story safeguards and disabled publish gates. Changes use a new `claude/*` branch, a PR, and explicit user approval before merging. Nothing runs on Render.
