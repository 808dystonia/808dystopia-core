# 808 Dystopia Automation

Daily 9:00 AM CT IG news carousel.

`Pinterest photo \u2192 classify \u2192 Genius \u2192 HTML slides \u2192 Composio IG publish \u2192 Sheet log`

Never generate cover art. If Pinterest and Google both miss, skip the article.

## Run
```bash
cp .env.example .env
npm install
CAROUSEL_PUBLISH=0 npm start
```

Publish stays off until `CAROUSEL_PUBLISH=1`.

## Render
Cron in `render.yaml`: `0 14 * * *` = 9:00 AM CDT.
Set env vars in the Render dashboard. Do not commit secrets.

## Locked rules
- Heat source: Discord `#underground-news` `1545437232142360599`
- Slide 1 cover + real photo only
- Album/EP/mixtape \u2192 tracklist slide, no album art on that slide
- Diss \u2192 origin quote
- Other \u2192 more info
- Caption ends with credit + `Follow for more.`
- First comments = 8-tag set split in two
