# 808 Dystopia Automation

Daily IG news carousel for @808dystopia, ~8:45 AM Central (before a 9:00 AM CT post).
Pipeline: select article → classify → get photo → diss content (if applicable) →
render slides → build caption → publish → log.

This repo is currently a **skeleton** — folder structure and stub files only.
No pipeline step has real logic yet; every client/pipeline function throws
`not implemented`. That's intentional: build and test each step one at a
time as credentials come in, rather than wiring the whole thing at once.

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

See `.env.example` for the full list: Composio API key, Discord channel ID,
Instagram user ID, Pinterest board ID, Gemini API key, Genius access token,
Google Custom Search (CSE id + key), Google Sheets ID.

## Hard rules (from the project spec)

- Never repeat a posted article unless the underlying story changed
- Never use AI-generated images — real photos only (Pinterest, then Google
  Custom Search fallback)
- No manual override/kill switch — fully hands-off once built
- 9 AM must be Central Time with correct DST handling — the current
  `render.yaml` schedule is a fixed UTC cron and does **not** handle DST;
  needs a real fix before launch
- Publishing stays gated behind `CAROUSEL_PUBLISH=1` until the pipeline is
  actually built and tested end-to-end
