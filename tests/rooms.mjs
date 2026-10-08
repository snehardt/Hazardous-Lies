import assert from 'node:assert/strict';
import http from 'node:http';
import { Server } from 'socket.io';
import { io } from 'socket.io-client';
import { attachRooms } from '../rooms.mjs';
const server = http.createServer(), sockets = new Server(server), rooms = attachRooms(sockets), clients = [];
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const once = (s, e) => new Promise(resolve => s.once(e, resolve));
const request = (s, e, data = null) => s.timeout(2000).emitWithAck(e, data);
async function client() { const s = io(`http://127.0.0.1:${server.address().port}`); clients.push(s); await once(s, 'connect'); return s; }
try {
  const a = await client(), b = await client(), c = await client(), d = await client(), e = await client();
  let next = once(a, 'room'); assert.equal((await request(a, 'create-room')).ok, true);
  let room = await next; const code = room.code; assert.match(code, /^[A-HJ-NP-Z2-9]{4}$/);
  assert.match((await request(a, 'start-game')).error, /two/);
  assert.match((await request(b, 'join-room', '0000')).error, /not found/);
  for (const s of [b,c,d]) assert.equal((await request(s, 'join-room', code.toLowerCase())).ok, true);
  assert.match((await request(e, 'join-room', code)).error, /full/);
  assert.match((await request(b, 'start-game')).error, /host/);
  next = once(a, 'room'); await request(a, 'start-game'); room = await next;
  assert.equal(room.phase, 'playing'); assert.deepEqual(room.players.map(p => p.slot), [0,1,2,3]);
  next = once(a, 'input'); b.emit('input', { epoch:room.epoch, action:'jump', down:true, slot:0 });
  assert.equal((await next).slot, 1);
  next = once(a, 'room'); b.disconnect(); room = await next;
  assert.equal(room.phase, 'lobby'); assert.equal(room.players[1], null);
  next = once(a, 'room'); await request(e, 'join-room', code); room = await next; assert.equal(room.players[1].id, e.id);
  await request(a, 'leave-room'); assert.equal(rooms.get(code).host, e.id);
  for (const s of [c,d,e]) await request(s, 'leave-room');
  assert.equal(rooms.size, 0);
  await request(c, 'create-room'); assert.equal(rooms.size, 1);
  console.log('Room flow passed: creation, errors, 4 players, host start, input identity, disconnect, slot reuse, host transfer, cleanup.');
} finally { clients.forEach(s => s.disconnect()); await new Promise(resolve => sockets.close(resolve)); }

