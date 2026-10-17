import {
  roomCode,
  validCode,
  validRoom,
  PROTOCOL,
  type Room,
} from './protocol.js';
export type { Room } from './protocol.js';
declare global {
  interface Window {
    HAZARDOUS_RELAY_URL?: string;
  }
}
type Reply = (value: { error?: string; ok?: boolean }) => void;

export async function connectOnline(
  onRoom: (room: Room) => void,
  onInput: (data: any) => void,
  onSnapshot: (data: any) => void,
  onLost: () => void
) {
  const status = document.getElementById('online-status')!;
  const endpoint = window.HAZARDOUS_RELAY_URL;
  if (!endpoint)
    throw new Error(
      'Online relay is not set up yet. The game owner needs to deploy the free Cloudflare Worker and set its URL in network-config.js.'
    );
  let base: URL;
  try {
    base = new URL(endpoint);
    if (
      base.protocol !== 'https:' &&
      !(
        base.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(base.hostname)
      )
    )
      throw new Error();
  } catch {
    throw new Error(
      'The multiplayer relay URL is invalid. Use the HTTPS Worker URL.'
    );
  }
  const response = await fetch(new URL('/health', base), {
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  }).catch(() => {
    throw new Error(
      'Cannot reach the multiplayer relay. Check your connection, then Retry Connection.'
    );
  });
  if (!response.ok || (await response.json()).protocol !== 4)
    throw new Error(
      'The multiplayer relay is unavailable or outdated. Check the Worker deployment and free daily limits, then Retry Connection.'
    );
  let socket: WebSocket | undefined,
    closed = false,
    current: Room | null = null,
    id = '',
    pending: Reply | undefined;
  let joinTimer: ReturnType<typeof setTimeout> | undefined,
    lastSeen = performance.now(),
    requestId = 0;
  const requests = new Map<
    number,
    { reply: Reply; timer: ReturnType<typeof setTimeout> }
  >();
  const finish = (error?: string) => {
    clearTimeout(joinTimer);
    const reply = pending;
    pending = undefined;
    reply?.(error ? { error } : { ok: true });
  };
  const lost = (message: string) => {
    const active = socket;
    socket = undefined;
    current = null;
    active?.close();
    finish(message);
    for (const { reply, timer } of requests.values()) {
      clearTimeout(timer);
      reply({ error: message });
    }
    requests.clear();
    if (!closed) {
      onLost();
      status.textContent = message;
    }
  };
  const send = (value: unknown) => {
    if (socket?.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify(value));
  };
  status.textContent =
    'Relay available. Create a room or join a six-character code.';
  const heartbeat = setInterval(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (performance.now() - lastSeen > 15000) {
      lost('Relay connection lost. Retry or create a new room.');
      return;
    }
    socket.send('ping');
  }, 5000);
  return {
    get id() {
      return id;
    },
    get connected() {
      return !closed;
    },
    sendInput(input: unknown) {
      send({ type: 'input', input });
    },
    sendSnapshot(state: any) {
      if (
        current?.host === id &&
        current?.phase === 'playing' &&
        state.epoch === current.epoch &&
        socket?.readyState === WebSocket.OPEN &&
        socket.bufferedAmount < 32768
      )
        send({ type: 'snapshot', state });
    },
    request(event: string, data: unknown, reply: Reply) {
      if (closed) {
        reply({ error: 'Retry Connection first.' });
        return;
      }
      if (event === 'start-game') {
        if (!current || current.host !== id) {
          reply({ error: 'Only the host can start.' });
          return;
        }
        const request = ++requestId;
        requests.set(request, {
          reply,
          timer: setTimeout(() => {
            requests.delete(request);
            reply({ error: 'Start request timed out. Retry.' });
          }, 10000),
        });
        send({ type: 'start', request });
        return;
      }
      if (!['create-room', 'join-room'].includes(event)) {
        reply({ error: 'Unknown room request.' });
        return;
      }
      if (current || pending) {
        reply({ error: 'Leave your current room first.' });
        return;
      }
      const code =
        event === 'create-room'
          ? roomCode()
          : typeof data === 'string'
            ? data.trim().toUpperCase()
            : '';
      if (!validCode(code)) {
        reply({
          error: 'Room not found. Enter the host’s six-character code.',
        });
        return;
      }
      pending = reply;
      id = '';
      const url = new URL(`/rooms/${code}`, base);
      url.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
      url.searchParams.set('mode', event === 'create-room' ? 'create' : 'join');
      const active = new WebSocket(url);
      socket = active;
      const fail = () => {
        if (socket === active)
          lost(
            'Could not connect to the room relay. Check the room code, host tab, and free daily limits, then retry.'
          );
      };
      active.onmessage = (event) => {
        if (socket !== active || closed) return;
        lastSeen = performance.now();
        if (event.data === 'pong') return;
        let message: any;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (message.type === 'welcome' && typeof message.id === 'string') {
          id = message.id;
          return;
        }
        if (message.type === 'error' || message.type === 'lost') {
          lost(String(message.message));
          return;
        }
        if (
          message.type === 'room' &&
          validRoom(message.room, PROTOCOL + code, id)
        ) {
          if (current && message.room.epoch < current.epoch) return;
          current = message.room;
          onRoom(structuredClone(current!));
          finish();
          return;
        }
        if (message.type === 'reply') {
          const request = requests.get(message.request);
          if (request) {
            clearTimeout(request.timer);
            requests.delete(message.request);
            request.reply(
              message.error ? { error: String(message.error) } : { ok: true }
            );
          }
          return;
        }
        if (message.type === 'input' && current?.host === id)
          onInput(message.input);
        if (
          message.type === 'snapshot' &&
          current?.host !== id &&
          current?.phase === 'playing' &&
          message.state?.epoch === current.epoch
        )
          onSnapshot(message.state);
      };
      active.onopen = () => {
        lastSeen = performance.now();
      };
      active.onerror = fail;
      active.onclose = fail;
      joinTimer = setTimeout(() => {
        if (socket === active && pending)
          lost('Room connection timed out. Keep the host tab open and retry.');
      }, 25000);
    },
    disconnect() {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      lost('Left online play.');
    },
  };
}
