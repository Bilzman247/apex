# Deriv Connection & OAuth Backup Guide

This folder contains a complete, production-ready backup of the **Deriv WebSocket API connection manager**, **OAuth 2.0 PKCE authentication flow**, **account session storage**, and **environment configuration**. 

---

## 📁 Folder Structure

```text
deriv-backup/
├── .env                  # Environment variables (App ID, Redirect URI, etc.)
├── .env.production       # Production environment settings
├── .env.example          # Template for required environment variables
├── README.md             # This guide
└── core/
    ├── package.json
    └── src/
        ├── auth/
        │   ├── accounts.ts   # Fetch accounts list & generate WebSocket OTP
        │   ├── crypto.ts     # PKCE code verifier, challenge, SHA-256
        │   ├── oauth.ts      # OAuth login, sign-up URL builder & token exchange
        │   └── storage.ts    # Secure session & local storage management
        ├── config/
        │   └── urls.ts       # Deriv production & staging endpoints
        ├── react/
        │   └── useDerivWS.ts # React hook for WebSocket connection & reconnection
        └── ws/
            └── deriv-ws.ts   # Lightweight WebSocket client with request/response & subscription streaming
```

---

## ⚙️ Environment Variables Setup

To allow users to log in through the UI and connect to Deriv API, make sure your `.env` (or `.env.production`) file contains the following variables:

```env
NEXT_PUBLIC_DERIV_APP_ID=33E1sj7WNaMsjg5MAxPyS
NEXT_PUBLIC_DERIV_REDIRECT_URI=https://g-squad.buzz
NEXT_PUBLIC_DERIV_APP_NAME=G-squad
NEXT_PUBLIC_DERIV_SHOW_APP_NAME=true
NEXT_PUBLIC_DERIV_REFERRAL_LINK=https://t.deriv.link?t=AJAQ5SJZLES4
NEXT_PUBLIC_DERIV_OAUTH_SCOPES=trade,account_manage
NEXT_PUBLIC_DERIV_ENV=production
```

### Deriv App Registration Requirements:
1. Register your app at [Deriv Developers Portal](https://developers.deriv.com/dashboard/).
2. Set the **Redirect URI** to match your hosted domain (e.g. `https://g-squad.buzz` or `http://localhost:3000` for local dev).
3. Ensure required scopes (`trade`, `account_manage`) are enabled on your App ID.

---

## 🚀 How to Use in Your Other App

### 1. Initialize OAuth Login from UI
When the user clicks the "Log in" button in your UI, call `initiateLogin`:

```typescript
import { initiateLogin } from './core/src/auth/oauth';

// Example login handler in your UI component
const handleLogin = async () => {
  await initiateLogin({
    clientId: process.env.NEXT_PUBLIC_DERIV_APP_ID!,
    redirectUri: process.env.NEXT_PUBLIC_DERIV_REDIRECT_URI!,
    scopes: 'trade account_manage',
  });
};
```

### 2. Handle OAuth Callback on Page Load
When Deriv redirects back to your app with `?code=...`, handle the callback to exchange the authorization code for access and refresh tokens:

```typescript
import { handleOAuthCallback } from './core/src/auth/oauth';
import { fetchAccounts, getWebSocketOTP } from './core/src/auth/accounts';

// Inside your main page / layout useEffect on mount:
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');

  if (code) {
    handleOAuthCallback(window.location.href, {
      clientId: process.env.NEXT_PUBLIC_DERIV_APP_ID!,
      redirectUri: process.env.NEXT_PUBLIC_DERIV_REDIRECT_URI!,
    }).then(async (authInfo) => {
      // Fetch user accounts
      const accounts = await fetchAccounts(authInfo, process.env.NEXT_PUBLIC_DERIV_APP_ID!);
      
      // Get authenticated WebSocket OTP URL for the active account
      const otpUrl = await getWebSocketOTP(accounts[0].account_id, authInfo, process.env.NEXT_PUBLIC_DERIV_APP_ID!);
      
      // Connect WebSocket using otpUrl
    }).catch((err) => {
      console.error('OAuth login failed:', err);
    });
  }
}, []);
```

### 3. Connect to Deriv WebSocket (`useDerivWS`)
Use the `useDerivWS` React hook to manage the WebSocket connection. Pass the authenticated OTP URL for private/trading actions, or leave undefined for public tick streaming:

```typescript
import { useDerivWS } from './core/src/react/useDerivWS';

function TradingComponent() {
  const { ws, isConnected, error } = useDerivWS({
    url: authenticatedOtpUrl, // optional: pass OTP URL for authenticated session
    accountId: activeAccountId,
  });

  // Send requests or subscribe to streams using ws.send() or ws.subscribe()
  useEffect(() => {
    if (isConnected && ws) {
      ws.send({ ticks: '1HZ100V' }).then((response) => {
        console.log('Tick data:', response);
      });
    }
  }, [isConnected, ws]);

  return <div>{isConnected ? 'Connected to Deriv WS' : 'Connecting...'}</div>;
}
```
