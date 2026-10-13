# Hazardous Lies

A golf platformer with two-player same-keyboard local play and 2–4 player online rooms with ten complete fixed-screen arenas, double jumps, wall jumps, and golf balls that turn player collisions into ridiculous airtime.

## Run

Play local or online: [Hazardous Lies](https://snehardt.github.io/Hazardous-Lies/).

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









## Online multiplayer (PeerJS + WebRTC)

Play at **[Hazardous Lies on GitHub Pages](https://snehardt.github.io/Hazardous-Lies/)**. Both local and online play work on this static site. No Render service, Socket.IO relay, or locally running Node server is needed to play.

1. Both players open the link and choose **Play Online**.
2. Wait for **Connected**, then one player chooses **Create Room**.
3. Share the **six-character room code** with up to three guests.
4. Guests enter that code and choose **Join Room**. The host can start once all game channels are ready.

Every online client controls only its assigned golfer: **A/D** move, **W** jump/double jump/wall jump, **S** recalls. Aim with the mouse; hold left click to charge and release to swing near your own slow/stationary ball. The host selects arenas, restarts, and advances levels. Local multiplayer controls, ball physics and level layouts are unchanged.

### Connections and hosting

PeerJS Cloud provides signaling to introduce browsers. Gameplay travels on WebRTC data channels between guests and the host. The app uses a reliable ordered control/input channel and a separate unordered binary snapshot channel, with send-buffer backpressure and snapshot sequence filtering. Binary chunking supports long recall histories. PeerJS's unordered option does not disable retransmissions; this is not a custom unreliable UDP protocol.

The host owns the four-player lobby, assigns slots from channel identities, validates/rate-limits guest input, and runs authoritative world physics. Guests cannot choose another player's slot or publish authoritative snapshots. Room codes are cryptographically random and protocol-namespaced; initial ID collisions retry with another code. Codes are invitations, not accounts or passwords.

A guest leaving returns everyone else to the lobby and frees that slot. The host starts a new match after any replacements join. **If the host leaves, the room ends** and guests can create or join another room. There is no automatic host migration. Connection timeouts and heartbeat cleanup handle broken peers, and leaving closes channels, signaling and timers. The host must keep the game tab visible; background browser throttling can still affect gameplay.

WebRTC cannot connect directly through every firewall or NAT. The default configuration uses PeerJS Cloud/STUN and has no provisioned TURN relay. On restrictive school/work networks, joining may fail with a timeout; use another network or configure a TURN service. PeerJS Cloud is still an external dependency for initial connection establishment. See [PeerJS connection requirements](https://peerjs.com/client/faq).

For a custom signaling server or TURN setup, define `window.HAZARDOUS_PEER_OPTIONS` before loading the game module. It accepts PeerJS options (host/port/path/secure and config.iceServers). Obtain short-lived TURN credentials from your provider; do not publish permanent secrets in the static site. The test suite uses this option for an ephemeral local signaling server; production uses PeerJS Cloud by default.

### Movement and walls

The host sends timestamped snapshots about **25 times per second**. Remote players and balls are rendered from a roughly 100 ms interpolation buffer. The joining player's own movement is predicted immediately using the same 120 Hz movement and collision code, then reconciled against host acknowledgements by replaying only unacknowledged commands. Guests do not simulate balls, other players or scoring. Movement history and host time budgets are bounded.

Small position corrections are eased only when the full player hull and correction path are clear. Respawns, restarts and level changes do not blend across the map. The wall crossing test also catches shallow overlaps left by corner landings. Movement speed, acceleration, gravity, jump strengths and ball physics are unchanged; intentional magnet recall still passes balls through terrain.

### Development and deployment

`pnpm install`, `pnpm build`, and `pnpm dev` run a static development server at http://localhost:5173. The build type-checks TypeScript and bundles PeerJS with the game, so there is no browser library CDN dependency. GitHub Actions builds and publishes index.html, style.css, assets and dist to GitHub Pages on every push to main. Relative asset paths support the /Hazardous-Lies/ project URL.

The former Render blueprint and Socket.IO room server have been removed from this repository. Removing configuration does not delete a previously created hosting account or service; an old deployment can be suspended separately.

### Validation

- `pnpm check`: TypeScript.
- `pnpm test:rooms`: room-code, identity, membership, epoch and input validation.
- `pnpm test:snapshots`: interpolation, ordering, packet loss, resets and independent respawns.
- `pnpm test:prediction`: acknowledgement/replay, delayed input, jump preservation, authority rate bounds and stalls.
- `pnpm test:online`: real WebRTC channels across four browser sessions, with an automatically started local PeerJS signaling server. Covers room capacity, movement ownership, large chunked snapshots, injected jitter/input lag, walls, disconnect/rejoin, host departure and return to local play. Set PEER_PUBLIC=1 to use public PeerJS signaling instead.
- `pnpm test`: the original local campaign suite, including 48 wall cases and 1,288 floor cases.

Build first and run the static development server for browser tests. Set TEST_URL to override http://localhost:5173. Install Playwright separately or set PLAYWRIGHT_PATH; BROWSER_CHANNEL=msedge uses installed Edge. Browser artifacts are written to artifacts/ and are not published.
