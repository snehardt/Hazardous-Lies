# Cloudflare setup — free game hosting and multiplayer

Use **Workers Free**. No credit card, paid plan, domain purchase, or Worker secrets are required for this deployment.

A Worker hosts the game and relays secure WebSocket traffic through one SQLite-backed Durable Object per room. The host browser still runs physics.

## Cost and limits

Verified October 14, 2026 using [Cloudflare's Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) and [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/):

- Workers Free: 100,000 dynamic requests/day; static assets are free and unlimited.
- Durable Objects Free: 100,000 request units/day and 13,000 GB-seconds/day. Incoming WebSocket messages count at a 20:1 ratio; outgoing messages do not count as requests.
- On Workers Free, operations fail when a free limit is exhausted. Daily limits reset at 00:00 UTC. There are no automatic usage overage charges on this plan.
- All projects in your account share these limits. Keep **Compute → Workers plans → Free** as your current plan. Do not click Upgrade or subscribe to Realtime.

## Deploy

From the project directory:

```sh
pnpm install
pnpm relay:login
pnpm relay:deploy
```

Verify your Cloudflare account email first. During login, review and authorize Wrangler in the browser. Deployment creates `hazardous-lies-relay`, its room namespace, and a free workers.dev address. No paid upgrade is part of the deployment command. If Cloudflare asks for billing or a paid plan, stop.

Open the HTTPS URL printed by Wrangler. That address serves both the game and its multiplayer relay. The Worker automatically serves `/network-config.js` with the correct public endpoint, and `/health` reports protocol version 4.

To update the existing GitHub Pages game too, set this public URL in the repository's `network-config.js`:

```js
window.HAZARDOUS_RELAY_URL = 'https://hazardous-lies-relay.YOUR-SUBDOMAIN.workers.dev';
```

Commit/push the game changes and let GitHub Pages finish its build. Players must refresh to load the updated game. Using the Cloudflare game link works immediately after Worker deployment.

## Local testing

```sh
pnpm build:site
pnpm relay:dev
```

Open http://localhost:8787 to play using the local Worker and local relay. Alternatively, run `pnpm dev` and temporarily set the static game's endpoint to `http://localhost:8787`. Local HTTP relay URLs are allowed only for localhost/127.0.0.1.

Run `pnpm test:network` for relay authority and lifecycle tests. With the static development server running and Playwright available, `pnpm test:online` starts a local Cloudflare runtime and tests four browser sessions. Set `TEST_URL` and `TEST_RELAY_URL` to the deployed Worker URL to test production instead.

For cross-network verification, open the Cloudflare game on home Wi-Fi and a phone hotspot, create a room and move both players. A successful join connects both players through the relay. A school/work network can still block all WebSockets or the workers.dev domain; no service can bypass every network policy.

## Troubleshooting

- **Relay not set up:** the GitHub Pages configuration has no Worker URL. Use the Cloudflare game URL or deploy the updated GitHub Pages files.
- **Relay unavailable/outdated:** check `/health`, deployment status and daily usage in Cloudflare.
- **Room not found:** use a fresh invite while the host's tab is open.
- **Connection lost:** retry; if the host disconnected, create a new room. Keep the host's game tab visible.
- **Origin not allowed:** add the game's exact origin, without a path, to `ALLOWED_ORIGINS` in `relay/wrangler.toml` and redeploy. The Worker's own origin is already allowed. Browser origin checks are not user authentication; room codes are invitations.

The relay uses WebSocket hibernation and automatic heartbeat responses rather than persistent timers. Room data is held in socket attachments and disappears when everyone disconnects. Credentials remain only in Wrangler's local authentication storage, never in the game or repository.
