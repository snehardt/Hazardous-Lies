import { levels, type Platform } from './levels.js';
const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = canvas.getContext('2d')!;
const $ = (id: string) => document.getElementById(id)!;
const W = 1280, H = 640, G = 1250, STEP = 1 / 120;
const colors = ['#f28a70', '#80c8df'];
type Ball = { x: number; y: number; vx: number; vy: number; grounded: boolean; grace: number; falling: number; resting: boolean; recallClear: { x: number; y: number } | null; progress: {x:number;y:number;distance:number} | null; visited: {x:number;y:number}[]; settle: number; trail: { x: number; y: number }[] };
type Player = { x: number; y: number; vx: number; vy: number; grounded: boolean; jumps: number; wall: number; coyote: number; facing: number; set: boolean; charging: boolean; power: number; angle: number; tumble: boolean; recovery: number; rotation: number; flip: number; flipDirection: number; anim: number; swing: number; strokes: number; falling: number; magnetHold: number; magnetActive: boolean; magnetUsed: boolean; magnetSpeed: number; ball: Ball };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };
let levelIndex = 0;
let platforms = levels[0].platforms, hole = levels[0].hole;
const scores = [0, 0];
const results: (number | null)[] = levels.map(() => null);
const levelSelect = $('level-select') as HTMLSelectElement;
levels.forEach((level, i) => levelSelect.add(new Option(`${i + 1}. ${level.name}`, String(i))));
const controls = [ { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', hit: 'Space' }, { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', hit: 'Slash' } ];
const keys = new Set<string>();
let players: Player[] = [], particles: Particle[] = [], started = false, winner = -1, paused = false;
let time = 0, last = 0, accumulator = 0, sound = false, audio: AudioContext | undefined;
let hintTimer = 0;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
function reset(play = true) {
  const { x: sx, y: sy } = levels[levelIndex].start;
  players = [sx, sx + 65].map((x, i) => ({ x, y: sy - 24, vx: 0, vy: 0, grounded: true, jumps: 0, wall: 0, coyote: .1, facing: 1, set: false, charging: false, power: 0, angle: Math.PI / 4, tumble: false, recovery: 0, rotation: 0, flip: 0, flipDirection: 1, anim: 0, swing: 0, strokes: 0, falling: 0, magnetHold: 0, magnetActive: false, magnetUsed: false, magnetSpeed: 0,
    ball: { x: x + 28, y: sy - 9, vx: 0, vy: 0, grounded: true, grace: 0, falling: 0, resting: true, recallClear: null, progress:null, visited:[], settle: 0, trail: [] } }));
  particles = []; winner = -1; started = play; paused = false; keys.clear();
  $('start').classList.toggle('hidden', play); $('win').classList.add('hidden');
  levelSelect.value = String(levelIndex);
  $('course-name').textContent = `HOLE ${levelIndex + 1} / 10`;
  $('level-idea').textContent = `${levels[levelIndex].idea} Difficulty ${levels[levelIndex].difficulty}/10`;
  setHint('HOLD S / DOWN TO RECALL A RESTING BALL', 7);
  updateHUD();
}
function loadLevel(index: number) {
  levelIndex = clamp(index, 0, levels.length - 1);
  platforms = levels[levelIndex].platforms; hole = levels[levelIndex].hole;
  reset(); canvas.focus();
}
function newMatch() { scores.fill(0); results.fill(null); loadLevel(0); }
function respawnPlayer(p: Player, i: number) {
  releaseMagnet(p);
  const start = levels[levelIndex].start;
  Object.assign(p, { x: start.x + i * 65, y: start.y - 24, vx: 0, vy: 0, grounded: true,
    jumps: 0, wall: 0, coyote: .1, facing: 1, set: false, charging: false, power: 0,
    tumble: false, recovery: 0, rotation: 0, flip: 0, falling: 0, magnetHold: 0, magnetActive: false, magnetSpeed: 0 });
}
function respawnBall(b: Ball, i: number) {
  const start = levels[levelIndex].start;
  Object.assign(b, { x: start.x + i * 65 + 28, y: start.y - 9, vx: 0, vy: 0,
    grounded: true, grace: .2, falling: 0, resting: true, settle: 0, trail: [] });
  players[i].set = players[i].charging = false;
  players[i].magnetHold = 0; players[i].magnetActive = false;
}
function surfaceY(s: Platform, x: number) { return s.y + (s.slope ?? 0) * clamp((x - s.x) / s.w, 0, 1); }
function platformBottom(s: Platform, x: number) { return s.floating ? surfaceY(s,x)+s.h : s.y+Math.max(0,s.slope??0)+s.h; }
function inSand(b: Ball) { return platforms.some(s => s.sand && b.x >= s.x && b.x <= s.x + s.w && Math.abs(b.y + 9 - surfaceY(s, b.x)) < 6); }
function shotSpeed(p: Player, power: number) { return (190 + power * 850) * (inSand(p.ball) ? .8 : 1); }
function inHazard(x: number, y: number, radius: number) {
  return y > H + 30 || levels[levelIndex].hazards.some(h => x + radius > h.x && x - radius < h.x + h.w && y + radius >= h.y && y - radius < h.y + h.h);
}
function beginFall(body: Player | Ball) {
  body.falling = 1; body.grounded = false; body.vx *= .3; body.vy = Math.max(130, body.vy);
  if ('set' in body) { body.set = body.charging = false; body.tumble = true; }
  burst(body.x, Math.min(body.y, H - 10), '#80c8df', 16, 160);
  beep(150, .2); setHint('SPLASH! BACK TO THE START');
}
levelSelect.addEventListener('change', () => loadLevel(Number(levelSelect.value)));
$('new-match').addEventListener('click', newMatch);
function beep(freq: number, duration = .08, type: OscillatorType = 'sine', volume = .045) {
  if (!sound) return;
  audio ??= new AudioContext();
  void audio.resume();
  const o = audio.createOscillator(), gain = audio.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, audio.currentTime); o.frequency.exponentialRampToValueAtTime(freq * .5, audio.currentTime + duration);
  gain.gain.setValueAtTime(volume, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
  o.connect(gain).connect(audio.destination); o.start(); o.stop(audio.currentTime + duration);
}
function setHint(message: string, seconds = 3) { $('hint').textContent = message; hintTimer = seconds; }
function burst(x: number, y: number, color: string, count = 12, force = 150) {
  for (let i = 0; i < count; i++) particles.push({ x, y, vx: (Math.random() - .5) * force * 2, vy: -Math.random() * force, life: .5 + Math.random() * .4, max: .9, color, size: 2 + Math.random() * 3 });
}
function hitDown(i: number) {
  const p = players[i], b = p.ball;
  if (p.tumble || p.falling || b.falling || p.magnetActive) return;
  p.magnetHold = 0;
  if (!p.set) {
    if (Math.hypot(p.x - b.x, p.y - (b.y - 16)) > 92 || Math.hypot(b.vx, b.vy) > 75) {
      setHint('GET CLOSER / LET YOUR BALL STOP'); return;
    }
    p.set = true; p.power = 0; p.vx = 0; p.angle = Math.PI / 4;
    setHint('LEFT/RIGHT: DIRECTION / UP/DOWN: ANGLE', 6);
    beep(360, .06);
  } else { p.charging = true; p.power = 0; beep(220, .04); }
}
function hitUp(i: number) {
  const p = players[i];
  if (!p.set || !p.charging || p.tumble || p.falling || p.ball.falling) return;
  const power = p.power, speed = shotSpeed(p, power);
  p.ball.vx = p.facing * Math.cos(p.angle) * speed;
  p.ball.vy = -Math.sin(p.angle) * speed;
  p.ball.grounded = false; p.ball.resting = false; p.ball.settle = 0; p.ball.grace = .2;
  p.set = false; p.charging = false; p.swing = .28; p.strokes++;
  burst(p.ball.x, p.ball.y, colors[i], 9, 110); beep(450 + power * 200, .13, 'triangle');
  updateHUD();
}
function jump(p: Player, i: number) {
  if (p.set || p.tumble) return;
  if (p.wall && !p.grounded && p.coyote <= 0) {
    p.vx = -p.wall * 390; p.vy = -490; p.facing = -p.wall; p.jumps = 1;
    burst(p.x + p.wall * 14, p.y, '#eff3ce', 8, 90);
  } else if (p.grounded || p.coyote > 0 || p.jumps < 2) {
    if (p.grounded || p.coyote > 0) p.jumps = 0;
    p.jumps++; p.vy = p.jumps === 2 ? -460 : -505;
    if (p.jumps === 2) { p.flip = .46; p.flipDirection = p.facing; }
    burst(p.x, p.y + 24, p.jumps === 2 ? colors[i] : '#d9e1b5', p.jumps === 2 ? 14 : 6, 100);
  } else return;
  p.grounded = false; p.coyote = 0; beep(p.jumps === 2 ? 620 : 410, .06, 'triangle');
}
document.addEventListener('keydown', e => {
  if (e.target instanceof HTMLButtonElement && (e.code === 'Space' || e.code === 'Enter')) return;
  if (controls.some(c => Object.values(c).includes(e.code)) || e.code === 'KeyR') e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'KeyH') { toggleHelp(); return; }
  if (e.code === 'KeyM') { toggleSound(); return; }
  if (!started && (e.code === 'Space' || e.code === 'Slash')) { reset(); canvas.focus(); return; }
  if (e.code === 'KeyR') { reset(); canvas.focus(); return; }
  keys.add(e.code);
  if (!started || winner >= 0 || paused) return;
  controls.forEach((c, i) => {
    const p = players[i];
    if (p.set && (e.code === c.left || e.code === c.right)) { p.facing = e.code === c.left ? -1 : 1; }
    if (e.code === c.up) jump(p, i);
    if (e.code === c.hit) hitDown(i);
  });
});
document.addEventListener('keyup', e => { keys.delete(e.code); if (started && winner < 0 && !paused) controls.forEach((c, i) => { if (e.code === c.hit) hitUp(i); }); });
window.addEventListener('blur', () => { keys.clear(); paused = true; players.forEach(p => { p.charging = false; p.power = 0; releaseMagnet(p); }); });
window.addEventListener('focus', () => { paused = false; last = performance.now(); accumulator = 0; });
document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); players.forEach(releaseMagnet); paused = true; } else { paused = false; last = performance.now(); accumulator = 0; } });
$('play').addEventListener('click', () => { reset(); canvas.focus(); });
$('again').addEventListener('click', () => {
  if (results.every(r => r !== null)) newMatch();
  else { const next = results.findIndex((r, i) => r === null && i > levelIndex); loadLevel(next >= 0 ? next : results.findIndex(r => r === null)); }
});
$('restart').addEventListener('click', () => { reset(); canvas.focus(); });
function toggleSound() {
  sound = !sound;
  $('sound').setAttribute('aria-pressed', String(sound));
  $('sound').setAttribute('aria-label', `Turn sound ${sound ? 'off' : 'on'} (M)`);
  beep(600); canvas.focus();
}
function toggleHelp() {
  const open = $('help-panel').classList.toggle('hidden') === false;
  $('help').setAttribute('aria-expanded', String(open));
  $('help').setAttribute('aria-label', `${open ? 'Hide' : 'Show'} controls (H)`);
  canvas.focus();
}
$('sound').addEventListener('click', toggleSound);
$('help').addEventListener('click', toggleHelp);

// Circle against a rounded rectangle. Curved normals let balls roll off edges.
function roundedContact(x: number, y: number, radius: number, s: Platform) {
  if (s.slope) {
    const vertices = [[s.x, s.y], [s.x + s.w, s.y + s.slope], [s.x + s.w, platformBottom(s,s.x+s.w)], [s.x, platformBottom(s,s.x)]];
    let inside = true, best = Infinity, qx = 0, qy = 0, ex = 0, ey = -1;
    vertices.forEach(([ax, ay], i) => {
      const [bx, by] = vertices[(i + 1) % 4], dx = bx - ax, dy = by - ay;
      if (dx * (y - ay) - dy * (x - ax) < 0) inside = false;
      const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
      const px = ax + t * dx, py = ay + t * dy, d = Math.hypot(x - px, y - py);
      if (d < best) { best = d; qx = px; qy = py; const length = Math.hypot(dx, dy); ex = dy / length; ey = -dx / length; }
    });
    if (!inside && best >= radius) return null;
    return { nx: inside || best < .001 ? ex : (x - qx) / best,
      ny: inside || best < .001 ? ey : (y - qy) / best, depth: inside ? radius + best : radius - best };
  }
  const cx = clamp(x, s.x + s.r, s.x + s.w - s.r), cy = clamp(y, s.y + s.r, s.y + s.h - s.r);
  const dx = x - cx, dy = y - cy, distance = Math.hypot(dx, dy), reach = s.r + radius;
  if (distance >= reach) return null;
  if (distance > .001) return { nx: dx / distance, ny: dy / distance, depth: reach - distance };
  const distances = [x - s.x, s.x + s.w - x, y - s.y, s.y + s.h - y];
  const face = distances.indexOf(Math.min(...distances));
  return { nx: face === 0 ? -1 : face === 1 ? 1 : 0, ny: face === 2 ? -1 : face === 3 ? 1 : 0, depth: radius + distances[face] };
}
function movePlayer(p: Player, dt: number, i: number) {
  // Sweep in small increments even during a high-speed bonk or long simulation step.
  const steps = Math.max(1, Math.ceil((Math.hypot(p.vx, p.vy) + G * dt + 265) * dt / 4));
  for (let step = 0; step < steps; step++) integratePlayer(p, dt / steps, i);
}
function integratePlayer(p: Player, dt: number, i: number) {
  p.flip = Math.max(0, p.flip - dt);
  if (p.falling > 0) {
    p.falling = Math.max(0, p.falling - dt); p.vy += 250 * dt;
    p.y = Math.min(H - 25, p.y + p.vy * dt); p.rotation += dt * 8;
    if (p.falling <= .00001) respawnPlayer(p, i);
    return;
  }
  if (inHazard(p.x, p.y, 24)) { beginFall(p); return; }
  const c = controls[i], wasGrounded = p.grounded;
  const oldX = p.x;
  p.swing = Math.max(0, p.swing - dt); p.anim += dt * (Math.abs(p.vx) > 30 ? 12 : 3);
  if (p.set && !p.tumble) {
    if (p.ball.falling || Math.hypot(p.ball.vx, p.ball.vy) > 90 || Math.hypot(p.x - p.ball.x, p.y - (p.ball.y - 16)) > 130) { p.set = false; p.charging = false; }
    else {
      if (keys.has(c.left)) p.facing = -1;
      if (keys.has(c.right)) p.facing = 1;
      p.angle = clamp(p.angle + ((keys.has(c.up) ? 1 : 0) - (keys.has(c.down) ? 1 : 0)) * dt * 1.25, 0, Math.PI * .48);
      if (p.charging) p.power = Math.min(1, p.power + dt * .66);
    }
  }
  if (!p.tumble) {
    const direction = p.set ? 0 : Number(keys.has(c.right)) - Number(keys.has(c.left));
    const target = direction * 265;
    p.vx += clamp(target - p.vx, -1800 * dt, 1800 * dt);
    if (direction) p.facing = direction;
  } else { p.vx *= Math.exp(-(p.grounded ? 9 : .3) * dt); p.rotation += p.vx * dt / 35; }
  const oldFoot = p.y + 24;
  // Remember the specific support, rather than snapping to every ramp whose height happens to match.
  const support = wasGrounded ? platforms.find(s => oldX >= s.x - .01 && oldX <= s.x + s.w + .01 && Math.abs(oldFoot - surfaceY(s, oldX)) < 2) : undefined;
  p.vy += G * dt; p.x += p.vx * dt; p.wall = 0;
  for (const s of platforms) {
    const sideX = p.vx > 0 ? s.x : s.x + s.w;
    const sideTop = surfaceY(s, sideX), bottom = platformBottom(s,sideX);
    if (support && sideX >= support.x - .1 && sideX <= support.x + support.w + .1 && Math.abs(surfaceY(support, sideX) - sideTop) < 2) continue;
    // The sloping top is walkable; only actual vertical side faces block horizontal motion.
    if (p.y + 24 <= sideTop + 5 || p.y - 24 >= bottom - 2) continue;
    if (p.vx > 0 && oldX + 13 <= s.x + .5 && p.x + 13 > s.x) { p.x = s.x - 13; p.wall = 1; p.vx = 0; }
    else if (p.vx < 0 && oldX - 13 >= s.x + s.w - .5 && p.x - 13 < s.x + s.w) { p.x = s.x + s.w + 13; p.wall = -1; p.vx = 0; }
  }
  if (p.x < 14) { p.x = 14; p.vx = 0; p.wall = -1; }
  if (p.x > W - 14) { p.x = W - 14; p.vx = 0; p.wall = 1; }
  const oldY = p.y; p.y += p.vy * dt; p.grounded = false;
  let landing = Infinity;
  for (const s of platforms) {
    if (p.x + 10 <= s.x || p.x - 10 >= s.x + s.w) continue;
    const top = surfaceY(s, clamp(p.x, s.x, s.x + s.w)), previousTop = surfaceY(s, clamp(oldX, s.x, s.x + s.w));
    const bottom = platformBottom(s,p.x);
    const followsSupport = p.vy >= 0 && !!support && Math.abs(oldFoot - previousTop) <= 5 && Math.abs(top - oldFoot) <= Math.abs(p.x - oldX) * 3 + 5;
    const crossesTop = p.vy >= 0 && oldFoot <= Math.max(top, previousTop) + 2 && p.y + 24 >= top;
    // Recover tiny overlaps at seams or after an impact instead of losing the floor forever.
    const shallowOverlap = p.vy >= 0 && oldFoot > top && oldFoot <= top + 8 && oldY - 24 < top && p.y + 24 >= top;
    if (followsSupport || crossesTop || shallowOverlap) landing = Math.min(landing, top);
    else if (p.vy < 0 && oldY - 24 >= bottom - .5 && p.y - 24 <= bottom) { p.y = bottom + 24; p.vy = 0; }
  }
  if (landing < Infinity) { p.y = landing - 24; p.vy = 0; p.grounded = true; }
  // Include the cap and rotating body in the screen boundary.
  const topRadius = p.tumble || p.flip > 0 ? 38 : 30;
  if (p.y < topRadius) { p.y = topRadius; p.vy = Math.max(0,p.vy); }
  if (p.wall && p.vy > 130 && !p.tumble) p.vy = 130;
  if (p.grounded) { p.flip = 0; p.jumps = 0; p.coyote = .09; if (!wasGrounded) burst(p.x, p.y + 24, '#e6e2bb', 6, 75); }
  else { p.coyote = Math.max(0, p.coyote - dt); if (!wasGrounded && p.coyote <= 0 && p.jumps === 0) p.jumps = 1; }
  if (p.tumble && p.grounded) {
    p.rotation = p.facing * Math.PI / 2; p.recovery += dt;
    if (p.recovery > .42) { p.tumble = false; p.rotation = 0; p.recovery = 0; burst(p.x, p.y, colors[i], 5, 65); }
  }
  if (inHazard(p.x, p.y, 24)) beginFall(p);
}
function moveBall(b: Ball, dt: number, owner: number) {
  if (b.falling > 0) {
    b.falling = Math.max(0, b.falling - dt); b.vy += 250 * dt;
    b.y = Math.min(H - 12, b.y + b.vy * dt); b.trail = [];
    if (b.falling <= .00001) respawnBall(b, owner);
    return;
  }
  if (!players[owner].magnetActive) trackBall(b);
  if (moveMagnet(players[owner], dt, owner)) return;
  if (inHazard(b.x, b.y, 9)) { beginFall(b); return; }
  if (b.resting) {
    if (Math.hypot(b.vx, b.vy) > 1) b.resting = false;
    else { b.grace = Math.max(0, b.grace - dt); b.trail = []; checkCup(b, owner); return; }
  }
  // Fast shots must not tunnel through thin shelves or the water surface.
  const steps = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy) + G * dt) * dt / 5));
  for (let j = 0; j < steps && !b.falling && winner < 0; j++) integrateBall(b, dt / steps, owner);
}
function integrateBall(b: Ball, dt: number, owner: number) {
  if (inHazard(b.x, b.y, 9)) { beginFall(b); return; }
  b.grace = Math.max(0, b.grace - dt);
  const groundBefore = b.grounded;
  b.vy += G * .8 * dt; b.vx *= Math.exp(-.045 * dt);
  if (groundBefore) { b.vx *= Math.exp(-.58 * dt); if (Math.abs(b.vx) < 3) b.vx = 0; }
  b.x += b.vx * dt; b.y += b.vy * dt; b.grounded = false;
  if (b.x < 9) { b.x = 9; b.vx = Math.abs(b.vx) * .72; }
  if (b.x > W - 9) { b.x = W - 9; b.vx = -Math.abs(b.vx) * .72; }
  if (b.y < 9) { b.y = 9; b.vy = Math.abs(b.vy) * .58; }
  let supported = false;
  for (let pass = 0; pass < 3; pass++) for (const s of platforms) {
    const contact = roundedContact(b.x, b.y, 9, s);
    if (!contact) continue;
    const { nx, ny, depth } = contact;
    b.x += nx * depth; b.y += ny * depth;
    if (ny < -.35) supported = true;
    if (s.sand && ny < -.35 && b.grace <= 0) {
      b.vx = b.vy = 0; b.grounded = true; b.resting = true;
      continue;
    }
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      const bounce = ny < -.65 && Math.abs(vn) < 70 ? 0 : .58;
      b.vx -= (1 + bounce) * vn * nx; b.vy -= (1 + bounce) * vn * ny;
      if (Math.abs(vn) > 100) { burst(b.x, b.y + 5, '#e7edc5', 4, 55); beep(180, .04, 'sine', .018); }
    }
    if (ny < -.65 && Math.abs(b.vy) < 35) b.grounded = true;
  }
  players.forEach((p, i) => {
    if (owner === i && b.grace > 0 || p.tumble || p.falling) return;
    // Feet and bodies never displace a slow or resting ball. Only travelling balls bonk.
    const speed = Math.hypot(b.vx, b.vy);
    if (b.resting || speed < 120) return;
    const cx = clamp(b.x, p.x - 10, p.x + 10), cy = clamp(b.y, p.y - 18, p.y + 20);
    let dx = b.x - cx, dy = b.y - cy, distance = Math.hypot(dx, dy);
    if (distance > 15) return;
    if (distance < .01) { dx = b.vx > 0 ? -1 : 1; dy = -.3; distance = Math.hypot(dx, dy); }
    const nx = dx / distance, ny = dy / distance;
    b.x += nx * (15 - distance); b.y += ny * (15 - distance);
    const incomingX = b.vx;
    const impact = b.vx * nx + b.vy * ny;
    if (impact >= 0) return;
    b.vx -= 2.15 * impact * nx; b.vy -= 2.15 * impact * ny;
    b.vy -= 95; b.vx = clamp(b.vx, -1150, 1150); b.vy = clamp(b.vy, -1100, 1100);
    p.vx = clamp(incomingX * .9, -760, 760); p.vy = -clamp(speed * .65, 290, 660);
    p.grounded = false; p.tumble = true; p.recovery = 0; p.set = p.charging = false; p.rotation = .3;
    burst(p.x, p.y, colors[i], 22, 220); beep(120, .18, 'sawtooth', .03);
    setHint(i === owner ? 'SELF BONK!' : 'BONK!');
  });
  if (supported && Math.hypot(b.vx, b.vy) < 55 && b.grace <= 0) b.settle += dt; else b.settle = 0;
  if (b.settle >= .12) { b.vx = b.vy = 0; b.grounded = b.resting = true; }
  checkCup(b, owner);
  if (inHazard(b.x, b.y, 9)) beginFall(b);
  if (Math.hypot(b.vx, b.vy) > 110) { b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 13) b.trail.shift(); }
  else if (b.trail.length) b.trail.shift();
}
// Recalls phase through solid terrain. A last-clear point makes releasing inside
// a wall safe without teleporting the ball forward or trapping it inside the wall.
function recallClear(x: number, y: number) {
  return !inHazard(x, y, 9) && !platforms.some(s => roundedContact(x, y, 8.8, s));
}
// Compare progress through open course space, rather than straight through decks.
// Both queries use ball-sized clearance so body size does not bias eligibility.
const ROUTE_CELL = 10, ROUTE_COLS = W / ROUTE_CELL, ROUTE_ROWS = H / ROUTE_CELL;
let routePlatforms: Platform[] | null = null;
let routeDistances = new Float64Array(0);
function routeSegmentClear(ax: number, ay: number, bx: number, by: number) {
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 5));
  for (let i = 0; i <= steps; i++) {
    const x = ax + (bx - ax) * i / steps, y = ay + (by - ay) * i / steps;
    if (x < 9 || x > W - 9 || y < 9 || y > H - 9 || !recallClear(x, y)) return false;
  }
  return true;
}
function routeDistance(x: number, y: number) {
  if (routePlatforms !== platforms) {
    routePlatforms = platforms;
    const count = ROUTE_COLS * ROUTE_ROWS, open = new Uint8Array(count);
    routeDistances = new Float64Array(count); routeDistances.fill(Infinity);
    const heap: {id:number;distance:number}[] = [];
    const push = (id:number,distance:number) => {
      routeDistances[id] = distance;
      let i = heap.length; heap.push({id,distance});
      while (i > 0) { const parent = (i - 1) >> 1; if (heap[parent].distance <= distance) break; heap[i] = heap[parent]; i = parent; }
      heap[i] = {id,distance};
    };
    for (let id = 0; id < count; id++) {
      const nx = (id % ROUTE_COLS) * ROUTE_CELL + 5, ny = Math.floor(id / ROUTE_COLS) * ROUTE_CELL + 5;
      open[id] = Number(routeSegmentClear(nx, ny, nx, ny));
      const distance = Math.hypot(nx - hole.x, ny - (hole.y - 10));
      if (open[id] && distance <= 25 && routeSegmentClear(nx,ny,hole.x,hole.y-10)) push(id,distance);
    }
    while (heap.length) {
      const node = heap[0], tail = heap.pop()!;
      if (heap.length) {
        let i = 0;
        while (i * 2 + 1 < heap.length) {
          let child = i * 2 + 1;
          if (child + 1 < heap.length && heap[child + 1].distance < heap[child].distance) child++;
          if (heap[child].distance >= tail.distance) break;
          heap[i] = heap[child]; i = child;
        }
        heap[i] = tail;
      }
      if (node.distance !== routeDistances[node.id]) continue;
      const col = node.id % ROUTE_COLS, row = Math.floor(node.id / ROUTE_COLS);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if ((!dx && !dy) || col+dx < 0 || col+dx >= ROUTE_COLS || row+dy < 0 || row+dy >= ROUTE_ROWS) continue;
        const id = node.id + dx + dy * ROUTE_COLS;
        const distance = node.distance + Math.hypot(dx,dy) * ROUTE_CELL;
        if (!open[id] || distance >= routeDistances[id]) continue;
        if (routeSegmentClear(col*10+5,row*10+5,(col+dx)*10+5,(row+dy)*10+5)) push(id,distance);
      }
    }
  }
  let distance = Infinity;
  const col = Math.floor(x / ROUTE_CELL), row = Math.floor(y / ROUTE_CELL);
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
    const nx = col+dx, ny = row+dy;
    if (nx < 0 || nx >= ROUTE_COLS || ny < 0 || ny >= ROUTE_ROWS) continue;
    const gx = nx*10+5, gy = ny*10+5, candidate = routeDistances[ny*ROUTE_COLS+nx]+Math.hypot(x-gx,y-gy);
    if (candidate < distance && routeSegmentClear(x,y,gx,gy)) distance = candidate;
  }
  return distance;
}
function trackBall(b: Ball) {
  if (!recallClear(b.x,b.y)) return;
  const last=b.visited[b.visited.length-1];
  if(last && Math.hypot(last.x-b.x,last.y-b.y)<24) return;
  const distance=routeDistance(b.x,b.y);
  if(!Number.isFinite(distance)) return;
  b.visited.push({x:b.x,y:b.y});if(b.visited.length>512)b.visited.shift();
  if(!b.progress || distance<b.progress.distance) b.progress={x:b.x,y:b.y,distance};
}
function magnetAngle(p: Player) { return Math.atan2(p.ball.y - (p.y + 6), p.ball.x - p.x); }
function releaseMagnet(p: Player) {
  if (p.magnetActive) {
    const b = p.ball;
    if (!recallClear(b.x, b.y) && b.recallClear) {
      b.x = b.recallClear.x; b.y = b.recallClear.y; b.vx = b.vy = 0;
    }
    b.resting = false; b.settle = 0; b.grace = 0; b.recallClear = null;
  }
  p.magnetHold = 0; p.magnetActive = false; p.magnetSpeed = 0;
  const owner = players.indexOf(p);
  if (owner >= 0 && !keys.has(controls[owner].down)) p.magnetUsed = false;
}
function moveMagnet(p: Player, dt: number, owner: number) {
  const b = p.ball;
  if (!keys.has(controls[owner].down) || p.set || p.tumble || p.falling || b.falling) {
    releaseMagnet(p); return false;
  }
  if (!p.magnetActive) {
    if (p.magnetUsed) return false;
    if (Math.hypot(b.vx, b.vy) > 3 || !b.resting) { p.magnetHold = 0; return false; }
    const ballRoute = routeDistance(b.x,b.y), playerRoute = routeDistance(p.x,p.y+15);
    const ahead = ballRoute + 8 < playerRoute;
    const recovering = !!b.progress && b.progress.distance + 8 < ballRoute && playerRoute + 8 >= b.progress.distance;
    if (!Number.isFinite(ballRoute) || !Number.isFinite(playerRoute) || (!ahead && !recovering)) { p.magnetHold = 0; return false; }
    p.magnetHold += dt;
    if (p.magnetHold < 1) return false;
    p.magnetActive = true; p.magnetUsed = true; p.magnetSpeed = 30;
    b.resting = b.grounded = false; b.settle = 0; b.grace = 0;
    b.recallClear = {x:b.x,y:b.y};
    setHint('MAGNET ON — RELEASE BEFORE THE BONK!'); beep(300,.12,'triangle');
  }
  p.magnetHold += dt; p.magnetSpeed = Math.min(1100, p.magnetSpeed + 360 * dt);
  const dx=p.x-b.x, dy=p.y-b.y, distance=Math.hypot(dx,dy), speed=p.magnetSpeed;
  const travel=Math.min(distance, speed*dt);
  b.vx=dx/Math.max(distance,.01)*speed; b.vy=dy/Math.max(distance,.01)*speed;
  // Sample clear locations even when callers advance more than one physics tick.
  const steps=Math.max(1,Math.ceil(travel/4));
  for(let step=0;step<steps;step++) {
    b.x+=dx/Math.max(distance,.01)*travel/steps; b.y+=dy/Math.max(distance,.01)*travel/steps;
    if(recallClear(b.x,b.y)) b.recallClear={x:b.x,y:b.y};
    // The pull keeps its direction through a bonk; only the other golfer is launched.
    for (let i=0;i<players.length;i++) {
      const other=players[i];
      if(i===owner || other.tumble || other.falling || speed<120 || !recallClear(b.x,b.y)) continue;
      const cx=clamp(b.x,other.x-10,other.x+10), cy=clamp(b.y,other.y-18,other.y+20);
      if(Math.hypot(b.x-cx,b.y-cy)>15) continue;
      other.vx=clamp(b.vx*.9,-760,760); other.vy=-clamp(speed*.65,290,660);
      other.grounded=false;other.tumble=true;other.recovery=0;other.rotation=.3;other.flip=0;
      other.set=other.charging=false; releaseMagnet(other);
      burst(other.x,other.y,colors[i],22,220);setHint('MAGNET BONK!');beep(120,.18,'sawtooth',.03);
    }
  }
  b.trail.push({x:b.x,y:b.y}); if(b.trail.length>13)b.trail.shift();
  if(distance-travel<=24) {
    const clear=b.recallClear;
    // Dock beside the original footing, never into a ramp or wall.
    const candidates=[{x:p.x+p.facing*28,y:p.y+15},{x:p.x-p.facing*28,y:p.y+15},{x:p.x,y:p.y+15}];
    const dock=candidates.find(c=>recallClear(c.x,c.y))??clear;
    if(dock){b.x=dock.x;b.y=dock.y;}
    b.vx=b.vy=0;b.resting=false;b.grace=.3;b.recallClear=null;
    p.magnetHold=0;p.magnetActive=false;p.magnetSpeed=0;
    if(speed>=160) {
      p.vx=clamp(dx/Math.max(distance,.01)*speed*.65,-700,700);
      p.vy=-clamp(speed*.65,290,660);p.grounded=false;p.tumble=true;
      p.recovery=0;p.rotation=.3;p.flip=0;p.set=p.charging=false;
      burst(p.x,p.y,colors[owner],22,220);setHint('MAGNET BONK!');beep(120,.18,'sawtooth');
    } else {burst(b.x,b.y,colors[owner],8,80);setHint('BALL RECALLED');}
  }
  return true;
}
function checkCup(b: Ball, owner: number) {
  if (Math.abs(b.x - hole.x) < hole.r - 2 && b.y > hole.y - 15 && b.y < hole.y + 20 && Math.abs(b.vx) < 340 && Math.abs(b.vy) < 220) win(owner);
}

function win(i: number) {
  if (winner >= 0) return;
  winner = i; keys.clear(); players.forEach(p => { p.charging = false; releaseMagnet(p); });
  const previous = results[levelIndex];
  if (previous !== null) scores[previous]--;
  results[levelIndex] = i; scores[i]++;
  const complete = results.every(r => r !== null);
  $('winner').textContent = complete ? scores[0] === scores[1] ? 'MATCH TIED!' : `${scores[0] > scores[1] ? 'CORAL' : 'BLUE'} TAKES THE MATCH!` : `${i === 0 ? 'CORAL' : 'BLUE'} +1 POINT!`;
  $('winner').style.color = colors[i];
  $('win-detail').textContent = `CORAL ${scores[0]} — BLUE ${scores[1]} / ${players[i].strokes} SHOTS`;
  $('again').textContent = complete ? 'NEW MATCH' : 'NEXT LEVEL ▶';
  $('win').classList.remove('hidden'); burst(hole.x, hole.y - 35, colors[i], 65, 370); beep(800, .4, 'triangle'); updateHUD();
}
function updateHUD() {
  players.forEach((p, i) => {
    $(`p${i + 1}-score`).textContent = `${scores[i]} POINT${scores[i] === 1 ? '' : 'S'}`;
    $(`p${i + 1}-state`).textContent = winner === i ? 'WINNER' : p.falling || p.ball.falling ? 'RESETTING...' : p.tumble ? 'AIRTIME!' : p.magnetActive ? 'MAGNET!' : p.magnetHold >= .5 ? 'MAGNET READY' : p.charging ? 'CHARGING' : p.set ? 'AIMING' : `${p.strokes} SHOTS`;
  });
  $('results').textContent = results.map((r, i) => `${i + 1}:${r === null ? '—' : r === 0 ? 'P1' : 'P2'}`).join('  ');
}
function update(dt: number) {
  time += dt;
  if (started && winner < 0 && !paused) {
    players.forEach((p, i) => movePlayer(p, dt, i));
    players.forEach((p, i) => { if (winner < 0) moveBall(p.ball, dt, i); });
    const a = players[0].ball, b = players[1].ball, dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (winner < 0 && !players.some(p => p.magnetActive) && !a.falling && !b.falling && (!a.resting || !b.resting) && Math.max(Math.hypot(a.vx,a.vy), Math.hypot(b.vx,b.vy)) > 120 && d < 18 && d > .001) {
      const nx = dx / d, ny = dy / d, overlap = (18 - d) / 2;
      a.x -= nx * overlap; a.y -= ny * overlap; b.x += nx * overlap; b.y += ny * overlap;
      const velocity = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (velocity < 0) { a.resting = b.resting = false; a.settle = b.settle = 0; const impulse = velocity * .91; a.vx += impulse * nx; a.vy += impulse * ny; b.vx -= impulse * nx; b.vy -= impulse * ny; }
    }
    hintTimer -= dt;
    if (hintTimer <= 0) $('hint').textContent = '';
    updateHUD();
  }
  particles.forEach(p => { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; });
  particles = particles.filter(p => p.life > 0);
}
function rect(x: number, y: number, w: number, h: number, color: string) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
function roundRect(x: number, y: number, w: number, h: number, r: number, color: string) { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
function ellipse(x: number, y: number, rx: number, ry: number, color: string) { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
function path(points: number[][], color: string) { ctx.fillStyle = color; ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); }
function cloud(x: number, y: number, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  roundRect(-50, 0, 130, 19, 10, '#edf2d4'); roundRect(-24, -16, 65, 31, 16, '#edf2d4'); roundRect(22, -7, 47, 24, 12, '#edf2d4'); ctx.restore();
}
function tree(x: number, y: number, scale: number, color: string) {
  rect(x - 3 * scale, y - 45 * scale, 6 * scale, 49 * scale, '#6a8060');
  ellipse(x, y - 58 * scale, 28 * scale, 27 * scale, color); ellipse(x - 17 * scale, y - 43 * scale, 23 * scale, 21 * scale, color); ellipse(x + 16 * scale, y - 44 * scale, 23 * scale, 23 * scale, color);
}
function background() {
  const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#b8d8cc'); sky.addColorStop(.65, '#e9edbb'); sky.addColorStop(1, '#dae0a6'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ellipse(1010, 107, 66, 66, '#f4edbb66'); ellipse(1010, 107, 46, 46, '#fff0c7');
  cloud(190 + Math.sin(time * .02) * 10, 85, 1.1); cloud(555, 120, .7); cloud(1140, 190, .6); cloud(760, 56, .55);
  path([[0,330],[135,203],[230,295],[365,155],[490,288],[620,205],[760,295],[889,214],[1060,313],[1185,232],[1280,294],[1280,640],[0,640]], '#91b6a3');
  path([[292,232],[365,155],[417,213],[378,196],[357,214],[342,208]], '#e0e8c8');
  path([[0,366],[98,329],[225,352],[340,312],[489,355],[630,309],[805,370],[981,324],[1113,357],[1280,303],[1280,640],[0,640]], '#80a989');
  path([[0,405],[185,381],[300,418],[520,378],[745,415],[970,377],[1145,403],[1280,383],[1280,640],[0,640]], '#a2bd87');
  for (let i = 0; i < 18; i++) tree(i * 84 + 11, 405 + Math.sin(i * 1.6) * 15, .55 + (i % 3) * .1, '#759c7c');
  path([[0,463],[204,437],[460,462],[700,438],[902,477],[1120,439],[1280,454],[1280,640],[0,640]], '#bbcb8e');
  // Old meadow fence and a tiny distant clubhouse.
  rect(1058, 373, 62, 34, '#d7d3a5'); path([[1046,375],[1089,347],[1132,375]], '#768e6c'); rect(1081,389,12,18,'#839a73'); rect(1101,382,10,9,'#a7c4b0');
  for (let i = 0; i < 17; i++) { rect(i * 85, 474, 4, 29, '#8b9f7370'); rect(i * 85, 482, 85, 4, '#8b9f7340'); }
  for (let i = 0; i < 5; i++) {
    const x = 375 + i * 145 + Math.sin(time * .4 + i) * 14, y = 87 + (i % 3) * 34;
    ctx.strokeStyle = '#64877580'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x, y + 3 + Math.sin(time * 2 + i) * 2); ctx.lineTo(x + 5, y); ctx.stroke();
  }
}
function drawIslandVines(s: Platform) {
  if(!s.floating) return;
  for(let j=0,x=s.x+12;x<s.x+s.w-8;x+=34,j++) {
    const y=platformBottom(s,x),length=10+(j%4)*4;
    // Attached edges and buried undersides do not sprout through their supports.
    if(platforms.some(other=>other!==s&&roundedContact(x,y+length/2,length/2+1,other))) continue;
    rect(x,y-2,2,length,'#577f48');
    rect(x-3,y+3,3,3,'#7ea454');rect(x+2,y+7,4,3,'#638b4d');
    if(length>15)rect(x-3,y+13,4,3,'#7ea454');
  }
}
function drawPlatform(s: Platform, index: number) {
  if (s.slope) {
    path([[s.x,s.y],[s.x+s.w,s.y+s.slope],[s.x+s.w,platformBottom(s,s.x+s.w)],[s.x,platformBottom(s,s.x)]], '#857b55');
    if(s.floating) {
      ctx.strokeStyle='#665c45';ctx.lineWidth=4;
      ctx.beginPath();ctx.moveTo(s.x,platformBottom(s,s.x)-2);ctx.lineTo(s.x+s.w,platformBottom(s,s.x+s.w)-2);ctx.stroke();
    }
    ctx.strokeStyle = s.sand ? '#edcf86' : '#a9ce70'; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(s.x, s.y + 4); ctx.lineTo(s.x + s.w, s.y + s.slope + 4); ctx.stroke();
    drawIslandVines(s);
    return;
  }
  roundRect(s.x + 3, s.y + 9, s.w, s.h, s.r, '#55785025');
  ctx.save(); ctx.beginPath(); ctx.roundRect(s.x, s.y, s.w, s.h, s.r); ctx.clip();
  rect(s.x, s.y, s.w, s.h, '#857b55'); rect(s.x, s.y + 20, s.w, s.h, '#786b4d');
  for (let j = 0; j < s.w / 23; j++) { rect(s.x + j * 23 + 5, s.y + 30 + (j % 3) * 13, 8, 5, '#a39263'); rect(s.x + j * 23 + 12, s.y + 45 + (j % 2) * 11, 4, 4, '#665c45'); }
  rect(s.x, s.y, s.w, 13, '#5d8b4a'); rect(s.x, s.y, s.w, 5, '#c4da86');
  for (let j = 0; j < s.w / 12; j++) rect(s.x + j * 12 + 3, s.y + 8, 5, 6 + (j % 3) * 2, '#7ea454');
  ctx.restore();
  if (s.sand) {
    rect(s.x + s.r, s.y, s.w - s.r * 2, 12, '#edcf86');
    for (let j = 0; j < s.w / 13; j++) rect(s.x + s.r + j * 13, s.y + 4 + j % 3, 3, 2, '#b39455');
  }
  if (index > 0) { for (let j = 0; j < s.w / 60; j++) { const x = s.x + 25 + j * 60; rect(x, s.y - 5, 2, 6, '#638b4d'); rect(x + 3, s.y - 8, 2, 9, '#7a9d53'); } }
  drawIslandVines(s);
}
function flower(x: number, y: number, color: string) { rect(x, y - 13, 2, 13, '#577f48'); rect(x - 4, y - 7, 4, 2, '#729b4f'); rect(x - 3, y - 17, 8, 7, color); rect(x, y - 15, 2, 3, '#f0dc8c'); }
function drawHole() {
  ellipse(hole.x, hole.y + 1, 21, 5, '#77954b'); ellipse(hole.x, hole.y, 16, 4, '#203d2a'); ellipse(hole.x, hole.y + 1, 10, 2, '#112a21');
  rect(hole.x + 2, hole.y - 98, 3, 97, '#ecedc9'); rect(hole.x + 5, hole.y - 96, 2, 93, '#667e5b');
  const wave = Math.sin(time * 3) * 3;
  path([[hole.x + 5, hole.y - 97],[hole.x + 46, hole.y - 92 + wave],[hole.x + 36, hole.y - 80 + wave],[hole.x + 5, hole.y - 77]], '#ef886c');
  rect(hole.x + 12, hole.y - 92, 4, 4, '#f7d4a6');
}
function drawPlayer(p: Player, i: number) {
  const color = colors[i], dark = i ? '#3b708c' : '#a65048', outline = '#263f37';
  ctx.save(); ctx.translate(Math.round(p.x), Math.round(p.y));
  if (p.tumble) { if (p.grounded) ctx.translate(0, 11); ctx.rotate(p.rotation); }
  if (!p.tumble && p.flip > 0) ctx.rotate(p.flipDirection * Math.PI * 2 * (1 - p.flip / .46));
  ctx.scale(p.facing, 1);
  const walk = p.grounded && Math.abs(p.vx) > 25 && !p.set;
  const bob = walk ? Math.sin(p.anim * 2) * 1.5 : Math.sin(time * 2.8 + i) * .7;
  ctx.translate(0, bob);
  const stride = walk ? Math.sin(p.anim) * 6 : 0;
  const airborne = !p.grounded && !p.set;
  // Pixel-built silhouettes: cap, neck, collared shirt, gloves, shorts and shoes.
  rect(-10, 7, 9, 16 - (airborne ? 5 : 0), outline); rect(2, 7, 9, 16 - (airborne ? 7 : 0), outline);
  rect(-8 + stride, 12 - (airborne ? 4 : 0), 5, 9, '#d8b485'); rect(4 - stride, 12 - (airborne ? 7 : 0), 5, 9, '#d8b485');
  rect(-11 + stride, 20 - (airborne ? 4 : 0), 10, 5, outline); rect(2 - stride, 20 - (airborne ? 7 : 0), 12, 5, outline);
  rect(-10, -9, 20, 24, outline); rect(-8, -7, 16, 20, color); rect(-8, 7, 16, 7, dark); rect(-1, 8, 3, 6, outline);
  rect(-3, -11, 8, 5, '#d9b88b'); rect(-3, -7, 4, 3, '#efedcf'); rect(1, -7, 4, 3, '#efedcf'); rect(0, -3, 2, 8, dark);
  rect(-8, -25, 17, 17, outline); rect(-6, -23, 13, 14, '#e5c598'); rect(7, -19, 4, 5, '#e5c598'); rect(3, -20, 3, 3, outline); rect(-6, -12, 7, 3, '#b99473');
  rect(-10, -29, 19, 9, outline); rect(-8, -28, 15, 6, color); rect(-7, -28, 4, 3, '#f8eed1'); rect(-9, -22, 25, 4, dark); rect(-8, -23, 23, 2, color);
  const armLift = p.set ? -3 : airborne ? -8 : stride * .4;
  rect(-13, -5 + armLift, 5, 14, outline); rect(-12, -3 + armLift, 4, 7, color); rect(-12, 4 + armLift, 4, 5, '#e5c598');
  rect(8, -5 + armLift, 5, 13, outline); rect(9, -3 + armLift, 4, 6, color); rect(9, 3 + armLift, 5, 6, '#eeeccf');
  ctx.save(); ctx.translate(12, 6 + armLift);
  if (p.magnetHold >= .5) {
    ctx.restore();
  } else {
  ctx.rotate(p.swing > 0 ? -1.7 + (1 - p.swing / .28) * 3 : p.charging ? -p.power * 1.4 : p.set ? -.4 : -.18);
  rect(0, -4, 3, 27, '#32483e'); rect(1, 0, 2, 22, '#c1cbbb'); rect(0, -5, 3, 7, '#5d6d58'); rect(0, 21, 10, 5, '#32483e'); rect(2, 21, 8, 3, '#d4dbca'); ctx.restore();
  }
  ctx.restore();
  if (p.magnetHold >= .5) {
    const angle=magnetAngle(p);
    ctx.save();ctx.translate(p.x+Math.cos(angle)*12,p.y+6+Math.sin(angle)*12);ctx.rotate(angle);
    rect(-2,-14,8,28,outline);rect(-2,-14,28,8,outline);rect(-2,6,28,8,outline);
    rect(0,-12,4,24,color);rect(0,-12,24,4,color);rect(0,8,24,4,color);
    rect(19,-12,5,4,'#fff1cf');rect(19,8,5,4,'#fff1cf');ctx.restore();
  }
  if (!p.tumble) {
    ctx.textAlign = 'center'; ctx.font = '8px Pixel, monospace'; ctx.fillStyle = outline; ctx.fillText(`P${i + 1}`, p.x, p.y - 40); ctx.textAlign = 'left';
    rect(p.x - 9, p.y - 36, 18, 2, color);
  }
}
function drawAim(p: Player, i: number) {
  if (!p.set || p.tumble) return;
  const b = p.ball, color = colors[i];
  ellipse(b.x, b.y + 7, 18 + Math.sin(time * 4) * 2, 5, color + '66');
  const speed = shotSpeed(p, p.charging ? p.power : .35);
  let x = b.x, y = b.y, vx = p.facing * Math.cos(p.angle) * speed, vy = -Math.sin(p.angle) * speed;
  for (let j = 0; j < 27; j++) {
    const dt = .027; x += vx * dt; y += vy * dt; vy += G * .8 * dt;
    if (x < 9 || x > W - 9 || platforms.some(s => roundedContact(x, y, 9, s))) break;
    ellipse(x, y, j < 3 ? 2.5 : 2, j < 3 ? 2.5 : 2, color + (j < 12 ? 'c0' : '60'));
  }
  const bx = clamp(p.x - 62, 12, W - 136), by = clamp(p.y - 100, 15, H - 60);
  rect(bx + 3, by + 4, 124, 43, '#302943'); rect(bx, by, 124, 43, '#302943');
  rect(bx + 3, by + 3, 118, 37, '#fff1cf'); rect(bx + 3, by + 3, 118, 3, color);
  ctx.fillStyle = '#302943'; ctx.font = '8px Pixel, monospace';
  ctx.fillText(`${Math.round(p.angle * 180 / Math.PI)}°`, bx + 9, by + 18);
  ctx.fillText(p.charging ? `${Math.round(p.power * 100)}%` : 'HOLD', bx + 73, by + 18);
  rect(bx + 9, by + 25, 106, 10, '#302943'); rect(bx + 11, by + 27, 102, 6, '#d7c2a6');
  for (let j = 0; j < 10; j++) if (p.power > j / 10) { rect(bx + 11 + j * 10.2, by + 27, 8, 6, j > 7 ? '#f0789a' : '#eebd57'); }
}
function drawBall(b: Ball, i: number) {
  if(b.progress && Math.hypot(b.progress.x-b.x,b.progress.y-b.y)>40) {
    ctx.save();ctx.globalAlpha=.4;ctx.strokeStyle=colors[i];ctx.lineWidth=2;ctx.setLineDash([3,4]);
    ctx.beginPath();ctx.arc(b.progress.x,b.progress.y,12,0,Math.PI*2);ctx.stroke();ctx.restore();
    ctx.font='6px Pixel, monospace';ctx.fillStyle=colors[i];ctx.textAlign='center';
    ctx.fillText(`P${i+1} BEST`,b.progress.x,b.progress.y-18);ctx.textAlign='left';
  }
  ctx.globalAlpha=.2;for(const point of b.visited) rect(point.x-1,point.y-1,2,2,colors[i]);ctx.globalAlpha=1;
  b.trail.forEach((p, j) => { ctx.globalAlpha = j / b.trail.length * .28; ellipse(p.x, p.y, 5, 5, colors[i]); }); ctx.globalAlpha = 1;
  ellipse(b.x, b.y + 8, 10, 3, '#243d322b'); ellipse(b.x, b.y, 9, 9, '#2d4438'); ellipse(b.x, b.y - 1, 7.5, 7.5, colors[i]);
  rect(b.x - 4, b.y - 5, 3, 3, '#fff7dc'); rect(b.x + 2, b.y - 2, 2, 2, i ? '#498ca5' : '#bf625a'); rect(b.x - 2, b.y + 3, 2, 2, i ? '#498ca5' : '#bf625a');
}
function render() {
  ctx.clearRect(0, 0, W, H); background();
  levels[levelIndex].hazards.forEach(h => {
    rect(h.x, h.y, h.w, h.h, h.kind === 'water' ? '#428aa9' : '#302943');
    if (h.kind === 'water') {
      rect(h.x, h.y, h.w, 5, '#b0e8ed');
      for (let x = h.x + 8; x < h.x + h.w - 20; x += 38) rect(x, h.y + 12 + Math.sin(time * 3 + x) * 3, 20, 2, '#80c8df');
    } else {
      for (let x = h.x; x < h.x + h.w; x += 20) path([[x,h.y+15],[x+9,h.y+4],[x+18,h.y+15]], '#71647e');
    }
  });
  platforms.forEach(drawPlatform);
  const start = levels[levelIndex].start;
  roundRect(start.x - 12, start.y - 2, 150, 5, 2, '#dbe3a6');
  ctx.font = '8px Pixel, monospace';
  ctx.fillStyle = '#302943'; ctx.fillText('START', start.x, start.y - 70);
  levels[levelIndex].labels.forEach(l => {
    const width = ctx.measureText(l.text).width;
    rect(l.x - 5, l.y - 12, width + 10, 18, '#fff1cfe0');
    ctx.fillStyle = '#302943'; ctx.fillText(l.text, l.x, l.y);
  });
  drawHole(); players.forEach(drawAim);
  players.forEach((p, i) => { ctx.globalAlpha = p.falling ? Math.max(.15, p.falling) : 1; drawPlayer(p, i); ctx.globalAlpha = 1; });
  players.forEach((p, i) => {
    if (winner !== i) { ctx.save(); drawBall(p.ball, i); ctx.globalAlpha = 1;
      if (p.ball.falling) { ctx.strokeStyle = colors[i]; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.ball.x, p.ball.y, 13 + (1 - p.ball.falling) * 10, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore(); }
  });
  particles.forEach(p => { ctx.globalAlpha = clamp(p.life / p.max, 0, 1); rect(p.x, p.y, p.size, p.size, p.color); }); ctx.globalAlpha = 1;
  if (paused && started && winner < 0) { ctx.fillStyle = '#30294399'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center'; ctx.fillStyle = '#fff1cf'; ctx.font = '24px Pixel, monospace'; ctx.fillText('PAUSED', W / 2, H / 2); ctx.textAlign = 'left'; }
}
function frame(now: number) {
  const elapsed = last ? Math.min((now - last) / 1000, .06) : 0; last = now;
  if (!paused) { accumulator += elapsed; while (accumulator >= STEP) { update(STEP); accumulator -= STEP; } }
  render(); requestAnimationFrame(frame);
}
reset(false); requestAnimationFrame(frame);
