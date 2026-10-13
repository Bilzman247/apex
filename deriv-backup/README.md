# Deriv Connection & OAuth Backup

This folder contains the complete backup of the Deriv WebSocket connection, OAuth 2.0 PKCE authentication flow, account management, and environment configuration (`.env`).

## Contents
- `.env`, `.env.production`, `.env.example`: Pre-configured environment variables for Deriv API & OAuth.
- `core/`: Core modules handling:
  - WebSocket client connection & streaming (`ws/deriv-ws.ts`, `react/useDerivWS.ts`)
  - OAuth PKCE login / sign-up / token exchange (`auth/oauth.ts`)
  - Account fetching & OTP WebSocket authentication (`auth/accounts.ts`)
  - Session & storage utilities (`auth/storage.ts`)
