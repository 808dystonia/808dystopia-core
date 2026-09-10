# 808 Dystopia Core

Clean restart of the 808 Dystopia ops bot.
Claude curates this repo. Old repos stay up until you can delete them:
- `808dystonia/808dystopiabot`
- `808dystonia/discord-gemini-bot`

## Stack
- Python worker on Render
- Discord ingest + Pinterest + IG jobs live here as they get rebuilt

## Render
1. https://dashboard.render.com/select-repo?type=blueprint
2. Connect GitHub account `808dystonia`
3. Select this repo
4. Apply the `render.yaml` blueprint
5. Add env vars from `.env.example` in the Render dashboard (never commit secrets)

Free web service sleeps. Use a Background Worker if you need it always on.

## Local
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python main.py
```
