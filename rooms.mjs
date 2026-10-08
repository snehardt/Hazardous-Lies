import { randomInt } from 'node:crypto';

// Room membership and identity are owned by the server, never by a client.
export function attachRooms(io) {
  const rooms = new Map();
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const view = r => ({ code: r.code, host: r.host, phase: r.phase, epoch: r.epoch,
    players: r.slots.map((id, slot) => id ? { id, slot } : null) });
  const broadcast = r => io.to(r.code).emit('room', view(r));
  io.on('connection', socket => {
    const current = () => rooms.get(socket.data.code);
    function leave() {
      const r = current();
      if (!r) return;
      r.slots[r.slots.indexOf(socket.id)] = null;
      socket.leave(r.code); delete socket.data.code;
      if (!r.slots.some(Boolean)) { rooms.delete(r.code); return; }
      if (r.host === socket.id) r.host = r.slots.find(Boolean);
      r.phase = 'lobby'; r.epoch++;
      io.to(r.code).emit('notice', 'A player left. The room is back in the lobby; a free slot can be joined.');
      broadcast(r);
    }
    const reply = (ack, value) => { if (typeof ack === 'function') ack(value); };
    socket.on('create-room', (_, ack) => {
      if (current()) return reply(ack, { error: 'Leave your current room first.' });
      let code;
      do { code = Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join(''); } while (rooms.has(code));
      const r = { code, slots: [socket.id, null, null, null], host: socket.id, phase: 'lobby', epoch: 0 };
      rooms.set(code, r); socket.data.code = code; socket.join(code);
      reply(ack, { ok: true }); broadcast(r);
    });
    socket.on('join-room', (code, ack) => {
      if (current()) return reply(ack, { error: 'Leave your current room first.' });
      const r = typeof code === 'string' ? rooms.get(code.trim().toUpperCase()) : null;
      if (!r) return reply(ack, { error: 'Room not found. Check the four-character code.' });
      const slot = r.slots.indexOf(null);
      if (slot < 0) return reply(ack, { error: 'This room is full (4 players).' });
      if (r.phase !== 'lobby') return reply(ack, { error: 'This match has started. Join when it returns to the lobby.' });
      r.slots[slot] = socket.id; socket.data.code = r.code; socket.join(r.code);
      reply(ack, { ok: true }); broadcast(r);
    });
    socket.on('start-game', (_, ack) => {
      const r = current();
      if (!r || r.host !== socket.id) return reply(ack, { error: 'Only the host can start.' });
      if (r.phase !== 'lobby' || r.slots.filter(Boolean).length < 2) return reply(ack, { error: 'Wait for at least two players.' });
      r.phase = 'playing'; r.epoch++; broadcast(r); reply(ack, { ok: true });
    });
    socket.on('leave-room', (_, ack) => { leave(); reply(ack, { ok: true }); });
    socket.on('input', data => {
      const r = current();
      if (!r || r.phase !== 'playing' || data?.epoch !== r.epoch) return;
      if (!['left', 'right', 'jump', 'recall', 'swing', 'aim', 'clear'].includes(data.action)) return;
      if (data.action === 'aim' && (!Number.isFinite(data.x) || !Number.isFinite(data.y))) return;
      if (data.action !== 'aim' && data.action !== 'clear' && typeof data.down !== 'boolean') return;
      const now = Date.now();
      if (now - (socket.data.inputWindow || 0) > 1000) { socket.data.inputWindow = now; socket.data.inputCount = 0; }
      if (++socket.data.inputCount > 240) return;
      io.to(r.host).emit('input', { slot: r.slots.indexOf(socket.id), epoch: r.epoch, action: data.action,
        down: data.down, x: Math.max(-1280, Math.min(2560, data.x || 0)), y: Math.max(-640, Math.min(1280, data.y || 0)) });
    });
    socket.on('snapshot', data => {
      const r = current();
      if (!r || r.phase !== 'playing' || r.host !== socket.id || data?.epoch !== r.epoch) return;
      if (!Array.isArray(data.players) || data.players.length !== r.slots.filter(Boolean).length || !Number.isInteger(data.levelIndex) || data.levelIndex < 0 || data.levelIndex > 9) return;
      const now = Date.now();
      if (now - (socket.data.snapshotAt || 0) < 25) return;
      socket.data.snapshotAt = now;
      socket.to(r.code).emit('snapshot', data);
    });
    socket.on('disconnect', leave);
  });
  return rooms;
}
