# Hazardous Lies

A golf platformer with two-player same-keyboard local play and 2–4 player online rooms with ten complete fixed-screen arenas, double jumps, wall jumps, and golf balls that turn player collisions into ridiculous airtime.

## Run

Static local-play version: [Hazardous Lies](https://snehardt.github.io/Hazardous-Lies/).

GitHub Pages builds and publishes the game automatically when changes are pushed to `main`. Both players share one keyboard on the computer opening the link.

Requires Node.js and npm (or pnpm).

```sh
npm install
npm run build
npm run dev
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

The first ball captured by the cup earns one point and ends that hole. Next Level advances to an unplayed arena. After all ten holes, the game announces the match winner or a tie. Points appear only in the corresponding player panel and are awarded when that player’s ball enters the cup. The course has no instructional labels or description rows below the arena selector.

R or the restart button replays the current arena while keeping match results. A replay replaces that hole's previous result when somebody wins; it cannot farm extra points. New Match clears points and results and starts at hole one. Results last for the current browser session.

There are **no checkpoints**. Entering water or a trap pit, or falling out of the arena, triggers a one-second falling animation, then respawns that individual golfer or ball at its original start. A golfer falling does not reset their successful ball, and a ball falling does not teleport its golfer. Shots taken remain counted.

Sand absorbs ball impacts and stops rolling almost completely. Shots from sand have **80% of normal launch speed**, including the trajectory guide. Grass retains bouncing and rolling physics until the ball settles. A settled ball stays fixed until a golf shot or a fast ball impact wakes it. Walking into balls cannot push them, and slow balls cannot shove golfers. Moving balls still knock golfers over. Fast balls use collision substeps to avoid passing through thin platforms.

Hold S / Down while not aiming to recall your own resting ball, when the ball is further along the course than you, or to recover lost progress in an area the ball already reached. Each ball records its explored trail and furthest progress using ball-sized routes around terrain to the cup. A faint trail and circular marker show that progress. The record survives water resets and backward collisions, allowing recovery toward your golfer up to the previously reached area. It cannot unlock unexplored forward progress, and restarting an arena clears the record. A U-shaped magnet points its open end toward the ball after half a second; pulling starts after one second and accelerates while held. The ball passes through walls, so it can escape tunnels. Release to stop pulling; the ball keeps its momentum. Releasing inside terrain returns it to the last clear position along its recall path. The recalled ball knocks other golfers into the air along its path, and a fast arrival also knocks its owner over. Release the key before starting another recall. Moving balls cannot activate the magnet, and Down still adjusts the angle while aiming.

## Validation

`npm run check` checks TypeScript. `npm test` runs the browser campaign suite when Playwright and a browser are available. Install Playwright separately for browser testing or set `PLAYWRIGHT_PATH` to an existing installation; set `BROWSER_CHANNEL=msedge` to use installed Edge rather than downloaded Chromium.

Separate tower checks verify all three intended shelf lifts and their clearances; boundary checks cover shots, ordinary jumps, flips and bonks for both players. The suite checks both players' controls, charging, aiming, jumps, collisions, stable starting positions, each arena's one-second independent resets, sand capture and power reduction, tunnel clearance, goal capture, replay scoring, ties and complete match progression. Regression checks cover stationary balls resisting pushes, nearby shots under roofs and beside walls, escape shots from slope corners, walking every ramp in both directions, moving-ball interference, and complete ground/water coverage along the screen bottom. Physics searches verify a player route and a sequence of ball shots from start to goal in every arena. Floor regressions test 1,288 combinations of surfaces, edge landings, shallow overlaps and fast falls. Collision substeps and shallow penetration recovery prevent missed floor contacts; flip timing is also checked. The sole S-shaped course requires multiple shots and a leftward return along the middle layer. Magnet tests check both controls, half-second/one-second hold timing, terrain-route eligibility, directional magnet rendering, acceleration, opponent and owner bonks, key-release rearming, wall traversal, safe release inside walls, water-reset history, backward-hit recovery and rejection of unexplored forward recalls. Rendered arena screenshots are saved under `artifacts/levels/`.

## Implementation

`src/levels.ts` contains all ten terrain layouts, hazards, starts, cups and route labels. `src/main.ts` contains the Canvas renderer and fixed 120 Hz physics loop. Original pixel portraits and CSS panels keep the interface compact. The Press Start 2P font is bundled with its SIL Open Font License; there are no runtime art or font downloads.









## Online multiplayer (Node.js + Socket.IO)

The opening menu offers **Play Local** (the original controls) and **Play Online**.
Run the Node server on one computer:

```sh
pnpm install
pnpm run build
pnpm run dev
```

npm install / npm run build / npm run dev work too. The server listens on **0.0.0.0:5173** by default. Open http://localhost:5173 on that computer. On another computer on the same network, open **http://SERVER_LAN_IP:5173** (find the host's IPv4 address with ipconfig). Allow Node through the host firewall for your private network if prompted. Both browsers must open the same Node server. A room code identifies a room on that server; it is not a server address.

Use Play Online → Create Room; share the four-character code; other clients choose Join Room. The lobby shows all four numbered slots. Only the host can start, and at least two players are required. During a match, joins are rejected. A client leaving or losing its connection returns the remaining players to the lobby and frees its slot. The next start begins a new match. If the host leaves, the lowest occupied slot becomes host. Empty rooms are deleted. Reconnected clients must explicitly rejoin; disconnected slots are not reserved.

Every online client controls only its assigned player: **A/D** move, **W** jump/double jump/wall jump, **S** recalls. Aim with the mouse; **hold left click to charge and release to swing** near your own slow/stationary ball. A short click produces a minimum-power swing. The cursor is converted from CSS-scaled canvas coordinates into the 1280×640 game world; the direction originates at your ball. Keyboard angle adjustment is disabled online. Existing shot power, terrain, collisions, ball physics, recall and knockback functions are reused. The host controls arena selection, restart and next level. Local color choices are restored when leaving online mode; online colors follow player slots.

### Architecture and assignment request flow

- Node's HTTP server listens on an IP/port and serves the game plus Socket.IO.
- Clients send create-room, join-room, start-game and leave-room requests. The server validates membership, capacity and host privileges, responds with acknowledgements/errors, and broadcasts lobby state.
- The server generates unique codes using cryptographic random selection, excluding 0/O and 1/I. Rooms exist only in memory.
- Clients send input requests. The server assigns their identity from the socket's room slot, validates actions, limits input rate and forwards them only to the host.
- **The host browser simulates the match**, using the same existing 120 Hz physics and rendering code as local play. All player/ball pairs participate in the existing collision rule. The host sends snapshots at 30 Hz; the server accepts snapshots only from that room's host and forwards them only to that room. Guests render those snapshots without running competing physics.
- Each start/disconnect changes a server-owned match epoch, rejecting packets from the previous match. Disconnect handling removes membership, transfers hosting, notifies peers, frees slots, and deletes empty rooms without stopping the server.

This is a server-mediated, host-simulated architecture, not cheat-resistant server-side physics. The host must keep the game tab open and visible: browsers throttle background tabs. Guests see network latency because prediction/interpolation is not implemented. The server provides validation and room isolation but trusts the host's simulation. For play outside your LAN, run this same Node service on a reachable server with HTTPS/WebSocket support; GitHub Pages alone cannot run it. No accounts, persistence, or automatic match-resume are implemented.

Override binding in PowerShell with `$env:PORT='5174'` and optionally `$env:HOST='0.0.0.0'` before running the server. Restart any older server process after updating this code. Builds must be rerun after TypeScript edits.

### Online validation

`pnpm run test:rooms` starts an ephemeral server and checks requests, invalid/full rooms, host-only starts, player identity, disconnect cleanup, host transfer and slot reuse. `pnpm run test:online` uses four separate browser sessions against a running server (default http://localhost:5173; override with TEST_URL). It checks the menu/lobby flow, ownership, double jump, scaled mouse aiming, swings, Player 4 wins, level synchronization, reconnect slot reuse and return to local. It uses the same PLAYWRIGHT_PATH and BROWSER_CHANNEL settings as the existing campaign suite and saves lobby/game screenshots under artifacts/. `pnpm test` continues to run the original local campaign regression suite.

## Free public multiplayer hosting

The included `render.yaml` deploys the entire game and Socket.IO server together as one **Free** Render web service. Start at [Deploy to Render](https://render.com/deploy?repo=https://github.com/snehardt/Hazardous-Lies), sign in, and review the Blueprint. Keep the service on the Free plan. Once deployment succeeds, share the assigned `https://…onrender.com` URL with every player. That link supports both local and online modes; the GitHub Pages link remains local-only because it cannot run Node.js.

Render's free service sleeps after 15 minutes without incoming traffic and takes about a minute to wake. Rooms are held in memory and disappear on restart or redeploy. For no charges, do not add a payment method: Render's documentation says it suspends services when free allowances are exceeded without a payment method. See [free limits](https://render.com/docs/free) and [billing FAQ](https://render.com/docs/faq).
