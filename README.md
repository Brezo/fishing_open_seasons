# 🎣 Catch of the Season

A static, location-aware fishing season guide — no backend, no build step, pure HTML + Vanilla JS.

## Project structure

```
fishing-app/
├── index.html                  ← App shell & markup
├── style.css                   ← All styling
├── app.js                      ← Data loading, location switching, filtering
└── data/
    ├── locations.json           ← Registry of all selectable regions
    ├── vienna_fish.json         ← Vienna-specific season rules
    ├── lower_austria_fish.json  ← Lower Austria season rules
    └── upper_austria_fish.json  ← Upper Austria season rules
```

## How the location system works

1. On load, `app.js` fetches `data/locations.json` and renders a button for each entry.
2. When the user clicks a region, the app fetches that region's fish file (e.g. `vienna_fish.json`).
3. The chosen region is saved in `sessionStorage`, so a page reload restores the selection.
4. All filtering (tags, in-season toggle, search) operates on the currently loaded region's data.

### locations.json schema

```json
[
  {
    "id":    "vienna",           ← unique key, also used in sessionStorage
    "label": "Vienna",           ← displayed on the button
    "flag":  "🏙️",              ← emoji shown next to label
    "file":  "vienna_fish.json" ← filename inside data/
  }
]
```

### Adding a new region

1. Create `data/salzburg_fish.json` with fish entries (see schema below).
2. Add one entry to `data/locations.json` pointing at that file.
3. No code changes needed — the UI auto-discovers the new button.

### Fish entry schema

```json
{
  "id": "unique-id",
  "name": "Common Name",
  "latinName": "Genus species",
  "season": {
    "open":  "MM-DD",   ← e.g. "04-01" = 1 April
    "close": "MM-DD"    ← wrap-around seasons supported (e.g. Oct–Jan)
  },
  "minSize_cm": 30,
  "description": "Short text shown on the card.",
  "tags": ["freshwater", "predator"]
}
```

Season windows that cross the year boundary (e.g. `open: "10-01"`, `close: "01-31"`) are handled automatically.

---

## Running locally

Because the app uses `fetch()`, you need a local HTTP server — browsers block it on `file://` URLs.

```bash
# Python (no install needed)
python3 -m http.server 8080
# → open http://localhost:8080
```

Or with Node: `npx serve .`

---

## Deploying to GitHub Pages

Push to a repo, then go to **Settings → Pages → Source: Deploy from branch → main / root**.

For automated deploys via GitHub Actions, create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - id: deployment
        uses: actions/deploy-pages@v4
```

---

> Data is illustrative. Always check official local regulations before fishing.
