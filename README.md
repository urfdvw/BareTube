# BareTube

A minimal distraction-free YouTube PWA.

Start using: urfdvw.github.io/BareTube/

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

## FAQ

### How can I play video in the background?

This totally depends on your OS and browser.
I use Firefox on Android with the "Video Background Play Fix" extension.

### Why am I getting ads?

You will need to log in to your YouTube account and also have a subscription.

If you have a subscription and are logged in to your YouTube account but are still seeing ads in BareTube,
it is probably because you have anti-tracking features enabled, so your YouTube cookies are not visible to BareTube.
Try turning that feature off in browser for BareTube.

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

## Stack

- Vite + React + TypeScript
- React Router (hash router)
- vite-plugin-pwa (service worker + manifest)
- LocalStorage only — no backend
