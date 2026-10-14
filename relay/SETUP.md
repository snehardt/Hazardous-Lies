# Enable reliable multiplayer with Cloudflare TURN

The game stays on GitHub Pages. This small Worker supplies temporary relay credentials so players behind restrictive routers can connect. Setting up the Worker alone does not enable it: the game must also receive its URL in `network-config.js`.

## 1. Create your account and TURN key

1. Create an account at https://dash.cloudflare.com/sign-up.
2. In the dashboard, open **Realtime** and its **TURN** section. Create a TURN key.
3. Save the **TURN key ID** and its **API token**. These belong only in Worker secrets. Do not paste them into GitHub, the game, or chat.

Cloudflare TURN is usage billed. The documented standalone price is $0.05 per outbound GB, checked October 14, 2026. Worker billing is separate; review the plans in your account. You do not need to transfer a domain to use a workers.dev endpoint.

Official guide: https://developers.cloudflare.com/realtime/turn/generate-credentials/

## 2. Deploy the supplied Worker

1. Open **Workers & Pages → Create application**. Choose a basic Worker starter, name it `hazardous-lies-relay`, then deploy.
2. Open **Edit code**, replace the starter code with the full contents of `relay/worker.mjs`, and deploy again.
3. Open the Worker's **Settings → Variables and Secrets → Add**. Add these two values with type **Secret**:

| Name | Value |
| --- | --- |
| `TURN_KEY_ID` | Your TURN key ID |
| `TURN_KEY_API_TOKEN` | The API token associated with that TURN key |

4. Save/deploy the settings. Copy the Worker URL, such as `https://hazardous-lies-relay.your-subdomain.workers.dev`.

The Worker allows browser requests from `https://snehardt.github.io` by default. For another domain, add an `ALLOWED_ORIGIN` variable containing only its origin (no path). Local development requires `http://localhost:5173`. Opening the Worker URL directly may show **Origin not allowed**; test it through the game, which sends an Origin header.

Origin checking controls browser access; it is not user authentication. This endpoint intentionally serves anyone playing the game. Monitor relay usage and use service rate limits if making it widely public.

Official guides: https://developers.cloudflare.com/workers/get-started/dashboard/ and https://developers.cloudflare.com/workers/configuration/secrets/

If your dashboard does not offer a code editor, use the included Wrangler configuration instead. From this project's terminal, run these commands one at a time and follow the browser login prompt:

```sh
pnpm dlx wrangler login
pnpm dlx wrangler deploy --config relay/wrangler.toml
pnpm dlx wrangler secret put TURN_KEY_ID --config relay/wrangler.toml
pnpm dlx wrangler secret put TURN_KEY_API_TOKEN --config relay/wrangler.toml
```

The `secret put` commands prompt for each value privately. The deploy output provides your public Worker URL.

## 3. Connect the game to the Worker

Edit `network-config.js`:

```js
window.HAZARDOUS_TURN_ENDPOINT = 'https://hazardous-lies-relay.your-subdomain.workers.dev';
```

Use your actual Worker URL. This URL is public; it is safe to share. Commit and push the game changes to `main`, then wait for GitHub Pages deployment to succeed. Both host and guest should refresh before creating a new room.

The game fetches temporary credentials on each online connection attempt and configures both WebRTC channels to use the provider's STUN and TURN addresses. Cloudflare includes TURN over TLS on port 443 for networks blocking ordinary UDP connections. Direct connections remain preferred where available. An empty endpoint uses the existing PeerJS defaults; it does not activate the new relay.

## 4. Verify relay operation

1. Test with the host and a guest on different networks, such as home Wi-Fi and a hotspot.
2. For a deliberate relay-only test, add this line after the endpoint in `network-config.js`:

```js
window.HAZARDOUS_PEER_OPTIONS = {config: {iceTransportPolicy: 'relay'}};
```

3. Rebuild/redeploy, refresh both browsers, create a new room, and confirm both players connect and can play. This rules out a successful direct connection concealing a broken relay.
4. Remove the relay-only override after verifying it, then rebuild/redeploy.

If the game reports **Could not load the multiplayer relay**, inspect the Worker settings/logs. Confirm both secret names and values, deployment status, and allowed origin. If loading succeeds but a friend still cannot join, their network may block WebRTC even through TURN/TLS; try another network and capture the exact game error.

`pnpm test:network` uses mocked temporary credentials. Set `TEST_RELAY_CONFIG=1` when running `pnpm test:online` to test browser credential loading alongside local WebRTC peers; this mock does not relay traffic. A provisioned account is required to verify actual Cloudflare relay connections.
