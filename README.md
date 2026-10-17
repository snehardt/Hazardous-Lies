# Hazardous Lies

A golf platformer with two-player same-keyboard local play and 2–4 player online rooms with ten complete fixed-screen arenas, double jumps, wall jumps, and golf balls that turn player collisions into ridiculous airtime.

## Run

Play local or online: [Hazardous Lies on Cloudflare](https://hazardous-lies-relay.spencer-ehardt.workers.dev).

The Cloudflare link hosts the game and free multiplayer relay. Local play shares one keyboard; online players use separate devices. The [GitHub Pages mirror](https://snehardt.github.io/Hazardous-Lies/) updates when changes are pushed to `main`.

Requires Node.js 22 or newer and pnpm.

```sh
pnpm install
pnpm build
pnpm dev
```

Open http://localhost:5173. The compiled game also works on a static web host: upload `index.html`, `style.css`, `assets/`, and `dist/`. Rebuild after editing TypeScript.

## Controls

| Action | Player 1 (Red by default) | Player 2 (Blue by default) |
| --- | --- | --- |
| Move | A / D | Left / Right |
| Jump, double jump, wall jump | W | Up |
| Set near your stationary ball | Space | / |
| Shot direction while set | A / D | Left / Right |
| Shot angle while set | W / S | Up / Down |
| Charge, then release to hit | Hold Space | Hold / |
| Recall a resting ball while not aiming | Hold S | Hold Down |

The first press sets; the next press charges, and releasing hits. A nearby slow or resting ball can be hit even beneath a ledge, inside a low tunnel, or between slopes. Aiming keeps the golfer where they are; it does not teleport them into a fixed stance. The golfer continues to obey terrain and gravity while aiming. Double jumps trigger a front flip in the facing direction; landing and respawning clear the flip. Player shadows are removed. Clubs only hit their owner's ball. Fast balls can bounce off either golfer and launch them; balls can also collide with each other. Switching away pauses the game and clears held keys. H shows controls and M toggles optional sound.

Each player can choose Red, Blue, Green, Yellow, Purple or Orange from the selector in their corner panel. Colors apply to the golfer, ball, magnet and effects, and remain selected when changing arenas or starting a new match. Players keep independent scores even when they choose the same color.

## Arenas and match rules

Use the Arena selector to test any of the ten courses. Every arena fits on screen and has a full player route, ball route, shared collision areas, catch terrain and a goal. Banks and hills connect to the ground. Only intentional airborne decks and shortcuts float. Their soil is 56–64 pixels deep, their undersides follow the top slopes, and vines hang along exposed edges. Sloping islands have matching collision shapes. The screen bottom always has land or water. Every terrain piece has a documented purpose in the level data. Slopes have actual collision surfaces. Low tunnels admit balls while keeping golfers outside. Platforms are stationary. Solid arena ceilings are removed: an invisible screen boundary stops golfers at the top and bounces balls back into the course. Only the first course uses three stacked fairways: the first travels right, the middle returns left, and the final fairway goes right to a putting hill. Alternating edge openings and solid decks obstruct direct shots across layers. Smooth connected ramps encourage rolling shots, and sand holds balls near each lift or drop. Other courses use ridges, a compact tower, diagonal funnels, a canyon, islands, bowls, tunnels and bunkers for variety.

1. Mind the Golf Gap — three ascending fairways, rolling stream banks and a right/left/right route.
2. Mouse Hole Mountain — ball tunnel through a mountain; golfers climb over it.
3. The Accidental Avalanche — roll down a valley, climb a ridge, plunge into a bowl, then climb to the cup.
4. Stairway to Fore — climb offset shelves beside an expanded right-hand bank, using 80-pixel side passages and 76-pixel headroom, then finish left on the upper fairway.
5. Island Hopping Handicap — island shots and small stepping platforms over water.
6. Around the Rim — a continuous basin with a broad flat sand catch before its center putting green.
7. Bunker Bargain — connected sand basins and a floating grass shortcut lead to a smooth uphill finish on a raised green.
8. Drop It Like a Putt — a thick floating tee funnel over water leads to a grounded second funnel connected directly to the flat final green.
9. Bank Statement — a solid central hill with a broad sand crest leads into an enclosed ricochet valley and raised goal green.
10. Crossing the Streams — connected valley slopes climb to a ball tunnel, then descend into a broad bowl and flat goal green.

The first ball captured by the cup earns one point. Everyone continues until all balls are in the cup; finished golfers cannot interfere. Each player then clicks Ready before the host can use Next Level to advance to an unplayed arena. The first-hole lineup is randomized. Later holes place the previous first finisher in front, followed by second, third and fourth. Four checked tee positions keep every golfer and ball clear of terrain. After all ten holes, the game announces the match winner or a tie. Points appear only in the corresponding player panel and are awarded when that player’s ball enters the cup. The course has no instructional labels or description rows below the arena selector.

R or the restart button replays the current arena while keeping match results. A replay replaces that hole's previous result when somebody wins; it cannot farm extra points. New Match clears points and results and starts at hole one. Results last for the current browser session.

There are **no checkpoints**. Entering water or a trap pit, or falling out of the arena, triggers a one-second falling animation, then respawns that individual golfer or ball at its original start. A golfer falling does not reset their successful ball, and a ball falling does not teleport its golfer. Shots taken remain counted.

Sand absorbs ball impacts and stops rolling almost completely. Shots from sand have **80% of normal launch speed**, including the trajectory guide. Grass retains bouncing and rolling physics until the ball settles. A settled ball stays fixed until a golf shot or a fast ball impact wakes it. Walking into balls cannot push them, and slow balls cannot shove golfers. Moving balls still knock golfers over. Fast balls use collision substeps to avoid passing through thin platforms.

Hold S / Down while not aiming to recall your resting ball to its best previously settled tee. Only actual resting locations count: flying through a better position does not unlock it. A faint rectangular outline in your color marks the saved tee. Backward shots and water resets preserve that tee; restarting clears it. Holding the magnet locks movement and jumping immediately. Pulling starts after 0.15 seconds and accelerates toward the saved tee, stopping exactly there without launching the owner. The ball can pass through terrain and bonk opponents along the way. Releasing inside terrain returns it to its last clear position. Release the key before starting another recall. Down still adjusts the angle while aiming.

## Validation

`npm run check` checks TypeScript. `npm test` runs the browser campaign suite when Playwright and a browser are available. Install Playwright separately for browser testing or set `PLAYWRIGHT_PATH` to an existing installation; set `BROWSER_CHANNEL=msedge` to use installed Edge rather than downloaded Chromium.

Separate tower checks verify all three intended shelf lifts and their clearances; boundary checks cover shots, ordinary jumps, flips and bonks for both players. The suite checks both players' controls, charging, aiming, jumps, collisions, stable starting positions, each arena's one-second independent resets, sand capture and power reduction, tunnel clearance, goal capture, replay scoring, ties and complete match progression. Regression checks cover stationary balls resisting pushes, nearby shots under roofs and beside walls, escape shots from slope corners, walking every ramp in both directions, moving-ball interference, and complete ground/water coverage along the screen bottom. Physics searches verify a player route and a sequence of ball shots from start to goal in every arena. Floor regressions test 1,288 combinations of surfaces, edge landings, shallow overlaps and fast falls. Collision substeps and shallow penetration recovery prevent missed floor contacts; flip timing is also checked. The sole S-shaped course requires multiple shots and a leftward return along the middle layer. Magnet tests check rapid activation, movement and jump locking, settled-tee eligibility, backward-shot and water recovery, exact docking, key-release rearming and safe release. Four-player spawn checks cover all ten levels, and 328 airborne ramp-impact cases supplement the floor regressions. Ready checks cover every finisher before advancing. Rendered arena screenshots are saved under `artifacts/levels/`.

## Implementation

`src/levels.ts` contains all ten terrain layouts, hazards, starts, cups and route labels. `src/main.ts` contains the Canvas renderer and fixed 120 Hz physics loop. Original pixel portraits and CSS panels keep the interface compact. The Press Start 2P font is bundled with its SIL Open Font License; there are no runtime art or font downloads.

## Online multiplayer (Cloudflare WebSocket relay)

The game and room relay can run together on Cloudflare Workers Free. GitHub Pages can also host the game using the public Worker URL in `network-config.js`. See [relay/SETUP.md](relay/SETUP.md) for deployment and free-plan limits.

1. Open the game and choose **Play Online**.
2. Choose **Create Room**, then **Copy Invite Link** and share it with up to three guests.
3. Opening an invite automatically joins the room. Guests can also paste the link or six-character code and press Enter.
4. The host starts once at least two players are connected. Keep the host's tab open and visible.

Each client controls its assigned golfer with A/D, W, S and mouse aiming/charging. The host selects arenas, restarts, and advances levels. A guest leaving returns the room to the lobby and frees their slot. When the host leaves, the room ends. Retry Connection reconnects to the service; an old invite cannot restore a departed host.

### Connection transport

Each browser connects to the Cloudflare Worker using secure WebSockets over HTTPS port 443. The relay forwards guest inputs to the host and host snapshots to guests. Networks that block WebSockets or Cloudflare can prevent play.

### Room authority and synchronization

One SQLite-backed Durable Object coordinates each room. The relay assigns socket identities and player slots, validates and rate-limits inputs, admits at most four players, and forwards snapshots only from the host. Codes are cryptographically random invitations, not accounts or passwords. Room metadata lives in WebSocket attachments so it survives hibernation; no database writes or saved match storage are needed. Heartbeats use Cloudflare's automatic response API to allow idle rooms to hibernate.

The host runs authoritative physics and sends snapshots about 25 times per second. Guests render remote entities through a roughly 100 ms interpolation buffer and predict their own movement at 120 Hz, reconciling only unacknowledged commands. Snapshot sequence/epoch filtering, send-buffer backpressure, input budgets, reset handling and wall-safe corrections remain in place. Guests do not simulate balls or scoring.

### Development and deployment

- `pnpm install`, `pnpm build`, `pnpm dev`: static development server at http://localhost:5173.
- `pnpm relay:dev`: local Cloudflare runtime at http://localhost:8787. Run `pnpm build:site` first.
- `pnpm relay:login`: authorize Wrangler in your Cloudflare account.
- `pnpm relay:deploy`: build the site and deploy the game plus relay. Keep the account on **Workers Free**.

Only public game files are packaged by `scripts/prepare-site.mjs`. GitHub Actions also uses that script to publish to GitHub Pages on pushes to main. The Worker serves its own public relay configuration automatically. GitHub Pages uses `network-config.js`, which must contain the deployed Worker URL.

### Validation

- `pnpm check`: TypeScript.
- `pnpm test:rooms`: room-code, membership, epoch and input validation.
- `pnpm test:network`: relay authority, capacity, invalid joins, hibernation recovery, host departure and origin checks.
- `pnpm test:snapshots`: interpolation, ordering, packet loss, resets and independent respawns.
- `pnpm test:prediction`: acknowledgement/replay, delayed input, jump preservation, authority bounds and stalls.
- `pnpm test:online`: four browser sessions against the actual local Cloudflare runtime. Covers invites, movement ownership, large snapshots, injected jitter/input lag, walls, disconnect/rejoin, host departure and return to local play.
- `pnpm test`: local campaign/physics suite.

Build first and run the static development server for browser tests. Install Playwright separately or set `PLAYWRIGHT_PATH`; `BROWSER_CHANNEL=msedge` uses installed Edge. `TEST_URL` overrides the game URL and `TEST_RELAY_URL` selects an already running relay, including the deployed Worker. A live relay test uses real game traffic and counts against free limits. Browser artifacts go under `artifacts/` and are not published.
