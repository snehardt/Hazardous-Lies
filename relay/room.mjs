import { PROTOCOL, validCode, validateGuestInput } from '../dist/protocol.js';

// The host runs physics; socket identities determine membership and input slots.
export class RoomRelay {

  constructor() {
    this.clients = new Map();
    this.room = null;
  }

  restore(socket, attachment) {
    if (!attachment?.room || !attachment.id) {
      socket.close(1008, 'Invalid session');
      return;
    }
    this.clients.set(socket, {
      id: attachment.id,
      slot: attachment.slot,
      window: 0,
      count: 0,
    });
    if (!this.room || attachment.room.epoch > this.room.epoch)
      this.room = attachment.room;
  }

  send(socket, value) {
    try {
      socket.send(JSON.stringify(value));
    } catch {
      this.remove(socket);
    }
  }

  publish() {
    if (!this.room) return;
    for (const [socket, client] of this.clients) {
      socket.serializeAttachment?.({ ...client, room: this.room });
      this.send(socket, { type: 'room', room: this.room });
    }
  }

  add(socket, code, mode) {
    const reject = (message) => {
      this.send(socket, { type: 'error', message });
      socket.close(1008, message);
      return false;
    };
    if (!validCode(code))
      return reject('Room not found. Enter the host’s six-character code.');
    if (mode === 'create') {
      if (this.room)
        return reject('That room code is already in use. Create another room.');
      const id = PROTOCOL + code;
      this.room = {
        code,
        host: id,
        phase: 'lobby',
        epoch: 0,
        players: [{ id, slot: 0 }, null, null, null],
      };
      this.clients.set(socket, { id, slot: 0, window: 0, count: 0 });
    } else {
      if (!this.room)
        return reject(
          'Room not found. Check the code and that the host is online.'
        );
      if (this.room.phase !== 'lobby')
        return reject('This match has started. Wait for the lobby.');
      const slot = this.room.players.indexOf(null);
      if (slot < 0) return reject('This room is full (4 players).');
      const id = crypto.randomUUID();
      this.clients.set(socket, { id, slot, window: 0, count: 0 });
      this.room.players[slot] = { id, slot };
    }
    this.send(socket, { type: 'welcome', id: this.clients.get(socket).id });
    this.publish();
    return true;
  }

  message(socket, raw) {
    const client = this.clients.get(socket);
    if (!client || !this.room) return;
    if (typeof raw !== 'string' || raw.length > 262144) {
      socket.close(1009, 'Message too large');
      this.remove(socket);
      return;
    }
    const now = Date.now();
    if (now - client.window >= 1000) {
      client.window = now;
      client.count = 0;
    }
    if (++client.count > 240) {
      socket.close(1008, 'Too many messages');
      this.remove(socket);
      return;
    }
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (message?.type === 'ping') {
      this.send(socket, { type: 'pong' });
      return;
    }
    if (message?.type === 'start') {
      const error =
        client.slot !== 0
          ? 'Only the host can start.'
          : this.room.phase !== 'lobby'
            ? 'The match has already started.'
            : this.clients.size < 2
              ? 'Wait for at least two players.'
              : undefined;
      if (!error) {
        this.room.phase = 'playing';
        this.room.epoch++;
        this.publish();
      }
      this.send(socket, {
        type: 'reply',
        request: message.request,
        ...(error ? { error } : { ok: true }),
      });
      return;
    }
    if (this.room.phase !== 'playing') return;
    if (message?.type === 'input' && client.slot !== 0 && raw.length <= 8192) {
      const input = validateGuestInput(
        message.input,
        client.slot,
        this.room.epoch
      );
      if (input)
        for (const [host, member] of this.clients)
          if (member.slot === 0) this.send(host, { type: 'input', input });
    }
    if (
      message?.type === 'snapshot' &&
      client.slot === 0 &&
      message.state?.epoch === this.room.epoch
    ) {
      for (const [guest, member] of this.clients)
        if (member.slot !== 0) this.send(guest, message);
    }
  }

  remove(socket) {
    const client = this.clients.get(socket);
    if (!client) return;
    this.clients.delete(socket);
    if (!this.room) return;
    if (client.slot === 0) {
      this.room = null;
      for (const guest of [...this.clients.keys()]) {
        this.send(guest, {
          type: 'lost',
          message: 'The host left. Create or join a new room.',
        });
        guest.close(1000, 'Host left');
      }
      this.clients.clear();
    } else {
      this.room.players[client.slot] = null;
      this.room.phase = 'lobby';
      this.room.epoch++;
      this.publish();
    }
  }
}
