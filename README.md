# G-squad Trading App

A self-hosted Rise/Fall trading app built on the Deriv WebSocket API. Supports CALL (Rise) and PUT (Fall) contract types with an interactive SmartCharts chart, real-time tick streaming, and open/closed position management.

## Prerequisites

- Node.js 18.18 or later

## Configuration (`.env`)

The application is pre-configured with the following environment variables:

```env
NEXT_PUBLIC_DERIV_APP_ID=33E1sj7WNaMsjg5MAxPyS
NEXT_PUBLIC_DERIV_REDIRECT_URI=https://g-squad.buzz
NEXT_PUBLIC_DERIV_APP_NAME=G-squad
NEXT_PUBLIC_DERIV_SHOW_APP_NAME=true
NEXT_PUBLIC_DERIV_REFERRAL_LINK=https://t.deriv.link?t=AJAQ5SJZLES4
NEXT_PUBLIC_DERIV_OAUTH_SCOPES=trade,account_manage
NEXT_PUBLIC_DERIV_ENV=production
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_DERIV_APP_ID` | Your Deriv app ID from the App Registration dashboard |
| `NEXT_PUBLIC_DERIV_REDIRECT_URI` | OAuth redirect URI — must exactly match the URI registered in your Deriv app |
| `NEXT_PUBLIC_DERIV_APP_NAME` | In-app display name (header, tab title, favicon) |
| `NEXT_PUBLIC_DERIV_SHOW_APP_NAME` | `true` shows the name next to the logo on desktop; `false` hides it |
| `NEXT_PUBLIC_DERIV_REFERRAL_LINK` | Affiliate referral link shown to unauthenticated users |
| `NEXT_PUBLIC_DERIV_OAUTH_SCOPES` | Comma-separated OAuth scopes (`trade,account_manage`) |
| `NEXT_PUBLIC_DERIV_ENV` | `production` to connect to the live Deriv endpoint |

## Local Development

```bash
npm install
npm run dev
```

The app is available at `http://localhost:3000`.

## Build for Production

```bash
npm run build
```
