export type Room = { code: string; host: string; phase: string; epoch: number; players: ({ id: string; slot: number } | null)[] };
type Socket = { id: string; connected: boolean; volatile: { emit: (event: string, ...args: any[]) => void }; on: (event: string, handler: (...args: any[]) => void) => void; emit: (event: string, ...args: any[]) => void; disconnect: () => void };
declare global { interface Window { io?: () => Socket } }
export async function connectOnline(onRoom: (room: Room) => void, onInput: (input: any) => void, onSnapshot: (state: any) => void, onLost: () => void) {
  if (!window.io) await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script'); script.src = '/socket.io/socket.io.js';
    script.onload = () => window.io ? resolve() : reject(new Error('Socket.IO unavailable.'));
    script.onerror = () => { script.remove(); reject(new Error('Open the game from the Node server to play online.')); };
    document.head.append(script);
  });
  const socket = window.io!(), status = document.getElementById('online-status')!;
  socket.on('room', onRoom); socket.on('input', onInput); socket.on('snapshot', onSnapshot);
  socket.on('notice', message => { status.textContent = message; });
  socket.on('disconnect', () => { onLost(); status.textContent = 'Disconnected. Your slot was freed. Rejoin using the code after reconnecting.'; });
  socket.on('connect_error', () => { status.textContent = 'Cannot reach server. Check the server address and network.'; });
  socket.on('connect', () => { status.textContent = 'Connected. Create a room or join a code.'; });
  return socket;
}
