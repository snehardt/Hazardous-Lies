import { RoomRelay } from './room.mjs';
import { validCode } from '../dist/protocol.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origins = (env.ALLOWED_ORIGINS || 'https://snehardt.github.io')
      .split(',')
      .map((s) => s.trim());
    const origin = request.headers.get('Origin');
    const headers = { 'Cache-Control': 'no-store', Vary: 'Origin' };
    if (origins.includes(origin))
      headers['Access-Control-Allow-Origin'] = origin;
    if (origin === url.origin) headers['Access-Control-Allow-Origin'] = origin;
    if (url.pathname === '/network-config.js')
      return new Response(
        `window.HAZARDOUS_RELAY_URL = ${JSON.stringify(url.origin)};`,
        {
          headers: {
            'Content-Type': 'text/javascript',
            'Cache-Control': 'no-store',
          },
        }
      );
    if (url.pathname === '/health' && request.method === 'GET')
      return Response.json(
        { ok: true, transport: 'websocket', protocol: 4 },
        { headers }
      );
    if (!url.pathname.startsWith('/rooms/'))
      return env.ASSETS
        ? env.ASSETS.fetch(request)
        : new Response('Not found', { status: 404 });
    if (!origins.includes(origin) && origin !== url.origin)
      return new Response('Origin not allowed', { status: 403 });
    const match = /^\/rooms\/([A-HJ-NP-Z2-9]{6})$/.exec(url.pathname);
    if (!match || !validCode(match[1]))
      return new Response('Room not found', { status: 404, headers });
    if (
      request.method !== 'GET' ||
      request.headers.get('Upgrade')?.toLowerCase() !== 'websocket'
    )
      return new Response('WebSocket required', { status: 426, headers });
    if (!['create', 'join'].includes(url.searchParams.get('mode')))
      return new Response('Invalid room action', { status: 400, headers });
    return env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(request);
  },
};

export class GameRoom {
  constructor(ctx) {
    this.ctx = ctx;
    this.relay = new RoomRelay();
    for (const socket of ctx.getWebSockets())
      if (socket.readyState === 1)
        this.relay.restore(socket, socket.deserializeAttachment());
    // Heartbeats respond while the object hibernates, without a recurring timer.
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong')
    );
  }
  async fetch(request) {
    const url = new URL(request.url),
      pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    this.relay.add(
      server,
      url.pathname.split('/').pop(),
      url.searchParams.get('mode')
    );
    return new Response(null, { status: 101, webSocket: client });
  }
  webSocketMessage(socket, message) {
    this.relay.message(socket, message);
  }
  webSocketClose(socket) {
    this.relay.remove(socket);
    socket.close(1000, 'Connection closed');
  }
  webSocketError(socket) {
    this.relay.remove(socket);
    socket.close(1011, 'Connection failed');
  }
}
