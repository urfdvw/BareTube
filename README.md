# BareTube

A minimal, privacy-friendly YouTube subscriptions PWA — no account required.

## Features

- Search YouTube (videos + channels)
- Subscribe to channels, stored locally in your browser
- Subscription feed sorted by date
- Embedded YouTube player with Media Session API (lock-screen controls)
- Daily API quota tracking with progress indicator
- Export / import your subscriptions as JSON
- Installable PWA (works offline for the app shell)

## Setup

1. Get a free YouTube Data API v3 key from [Google Cloud Console](https://console.developers.google.com)
2. Open the app → hamburger menu → Settings → paste your API key

## API Quota

The YouTube Data API v3 provides **10,000 free units per day**.

| Operation | Cost |
|---|---|
| Search | 100 units |
| Channel details | 1 unit |
| Playlist (uploads) fetch | 1 unit |
| Video details | 1 unit |

## Development

```bash
npm install
npm run dev       # dev server at http://localhost:5173
npm run build     # outputs to docs/ for GitHub Pages
```

## Deployment

GitHub Pages: Settings → Pages → Source: `docs/` folder on `main`.

## Limitations

- **Ads**: cannot be removed via embed player (YouTube Premium required)
- **Background playback**: not reliably supported on all mobile browsers
- **Shorts**: not filtered from results
- **Audio-only**: not possible without ToS violation

## Stack

- Vite + React + TypeScript
- React Router (hash router)
- vite-plugin-pwa (service worker + manifest)
- LocalStorage only — no backend
