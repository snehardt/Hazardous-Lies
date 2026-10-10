// Presentation only: no collision, gravity, or gameplay updates run here.
export type Body = { x: number; y: number; vx: number; vy: number; revision?: number };
export type Pose = Body & { ball: Body; anim: number; rotation: number; flip: number; power: number; angle: number; swing: number; falling: number };
export type Snapshot<P extends Pose> = { seq: number; sentAt: number; generation: number; levelIndex: number; players: P[] };

function mixBody<T extends Body>(a: T, b: T, t: number): T {
  // Respawns are intentional teleports, not a path across the arena.
  if (a.revision !== b.revision) return { ...a };
  const out = { ...a };
  for (const key of ['x', 'y', 'vx', 'vy'] as const) out[key] = a[key] + (b[key] - a[key]) * t;
  return out;
}

export class SnapshotBuffer<P extends Pose, S extends Snapshot<P>> {
  private queue: S[] = [];
  private cursor = 0;
  private lastSeq = -1;
  private arrival = 0;
  clear() { this.queue = []; this.lastSeq = -1; this.cursor = 0; this.arrival = 0; }
  push(state: S, now: number): boolean {
    if (!Number.isFinite(state.sentAt) || !Number.isInteger(state.seq) || state.seq <= this.lastSeq) return false;
    const previous = this.queue.at(-1);
    if (previous && state.sentAt <= previous.sentAt) return false;
    if (!previous || previous.generation !== state.generation || previous.levelIndex !== state.levelIndex || now - this.arrival > 1000) {
      this.queue = []; this.cursor = state.sentAt - 100;
    }
    this.queue.push(state); this.lastSeq = state.seq; this.arrival = now;
    if (this.queue.length > 32) this.queue.shift();
    return true;
  }
  sample(elapsedMs: number): S | undefined {
    const newest = this.queue.at(-1);
    if (!newest) return;
    // A monotonic host timeline absorbs packet jitter without using synchronized clocks.
    // Slowly recover buffer depth after a stall; never extrapolate through terrain.
    const depth = newest.sentAt - this.cursor;
    const speed = depth > 140 ? 1.1 : depth < 60 ? .9 : 1;
    this.cursor = Math.min(newest.sentAt, this.cursor + Math.max(0, elapsedMs) * speed);
    if (depth > 500) this.cursor = newest.sentAt - 100;
    while (this.queue.length > 1 && this.queue[1].sentAt <= this.cursor) this.queue.shift();
    const a = this.queue[0], b = this.queue[1];
    if (!b || this.cursor <= a.sentAt) return { ...a, players: a.players.map(p => ({ ...p, ball: { ...p.ball } })) };
    const t = (this.cursor - a.sentAt) / (b.sentAt - a.sentAt);
    const players = a.players.map((p, i) => {
      const next = b.players[i];
      if (!next) return { ...p, ball: { ...p.ball } };
      const out = mixBody(p, next, t);
      if (p.revision === next.revision) {
        for (const key of ['anim', 'rotation', 'power', 'angle', 'swing', 'falling'] as const) out[key] = p[key] + (next[key] - p[key]) * t;
        // A new flip starts at .46; don't blend its start backwards from zero.
        if (p.flip > 0 && next.flip > 0) out.flip = p.flip + (next.flip - p.flip) * t;
      }
      out.ball = mixBody(p.ball, next.ball, t);
      return out;
    });
    return { ...a, players };
  }
}
