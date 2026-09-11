# 808 Dystopia Automation

Daily IG news carousel for @808dystopia, posting twice daily around 9:00 AM and 12:00 PM Central.
Pipeline: select article → classify → get photo → diss content (if applicable) →
render slides → build caption → publish → log.

Steps 1-3 (select article, classify, get photo) are real and tested against
live services. Steps 4-8 are still stubs — every function there throws
`not implemented`. Building one step at a time as credentials come in,
rather than wiring the whole thing at once.

## Layout

- `src/pipeline/` — the 8 numbered steps + `index.js` orchestrator
- `src/clients/` — thin wrappers around each external API
- `src/templates/` — HTML slide templates (placeholders until STOKELY's
  Canva export + font file are in hand) and `assets/` for static files
  (font, closer video) once provided
- `src/config.js` — reads all IDs/keys from env, no hardcoded values
- `render.yaml` — Render free-tier cron job config

## Run

```bash
cp .env.example .env
npm install
npm start
```

## Credentials to gather

See `.env.example` for the full list: Composio project API key + connected
account IDs (Discord, Pinterest, Google Sheets), Gemini API key, Genius
access token, Spotify Client ID/Secret, Google Sheets ID.

## Hard rules (from the project spec)

- Never repeat a posted article unless the underlying story changed
- Never use AI-generated images — real photos only, from Pinterest's own
  pinned content (Composio). Google Custom Search was dropped as a
  fallback: Google discontinued free "search the entire web" for new
  Programmable Search Engines (March 2026), so it can no longer act as an
  open-web fallback. If Pinterest has nothing pinned for an artist, that
  candidate is skipped in favor of the next-newest unused one.
- No manual override/kill switch — fully hands-off once built
- 9 AM must be Central Time with correct DST handling — the current
  `render.yaml` schedule is a fixed UTC cron and does **not** handle DST;
  needs a real fix before launch
- Publishing stays gated behind `CAROUSEL_PUBLISH=1` until the pipeline is
  actually built and tested end-to-end

## Composio setup notes

Project API keys can only see connected accounts made *for that project*
(via `POST /connected_accounts/link`), not whatever's connected through the
personal dashboard/login or the CLI's default session. Each toolkit
(Discord, Pinterest, Google Sheets) needed its own auth config + connection
created against this project specifically — see git history on
`src/clients/composio.js` and friends for the exact flow if a new
connection needs to be added.
