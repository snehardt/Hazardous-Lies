import { Peer, type DataConnection, type PeerOptions } from 'peerjs';
import { PROTOCOL, roomCode, validCode, validRoom, inputFromPeer, type Room } from './protocol.js';
import { loadPeerOptions } from './network.js';
export type { Room } from './protocol.js';
// Optional private signaling / short-lived TURN configuration. Defaults to PeerJS Cloud.
declare global { interface Window { HAZARDOUS_PEER_OPTIONS?: PeerOptions; HAZARDOUS_TURN_ENDPOINT?:string } }
type Reply=(value:{error?:string;ok?:boolean})=>void;
type Link={control:DataConnection;state?:DataConnection;seen:number;window:number;count:number};
export async function connectOnline(onRoom:(room:Room)=>void,onInput:(data:any)=>void,onSnapshot:(data:any)=>void,onLost:()=>void,onReady:(ready:boolean)=>void=()=>{}) {
  const status=document.getElementById('online-status')!;
  const options=await loadPeerOptions(window.HAZARDOUS_PEER_OPTIONS,window.HAZARDOUS_TURN_ENDPOINT);
  let peer:Peer,closed=false,current:Room|null=null,hostLink:Link|undefined;
  let joining:Reply|undefined,joinTimer:ReturnType<typeof setTimeout>|undefined,attempts=0;
  const guests=new Map<string,Link>(), pendingConnections=new Set<DataConnection>();
  const timers=new Set<ReturnType<typeof setTimeout>>();
  const later=(fn:()=>void,ms:number)=>{const t=setTimeout(()=>{timers.delete(t);fn();},ms);timers.add(t);return t;};
  const send=(connection:DataConnection|undefined,message:unknown)=>{
    if(!connection?.open)return;
    try {void Promise.resolve(connection.send(message)).catch(()=>connection.close());}catch {connection.close();}
  };
  const publish=()=>{
    if(!current)return;
    onRoom(structuredClone(current));
    for(const link of guests.values())send(link.control,{type:'room',room:current});
  };
  const finishJoin=(error?:string)=>{
    clearTimeout(joinTimer);const reply=joining;joining=undefined;reply?.(error?{error}:{ok:true});
  };
  function loseHost(message:string) {
    const link=hostLink;hostLink=undefined;current=null;
    link?.state?.close();link?.control.close();finishJoin(message);
    onLost();status.textContent=message;
  }
  function dropGuest(id:string,link:Link) {
    if(guests.get(id)!==link)return;
    guests.delete(id);link.state?.close();link.control.close();
    if(!current || closed)return;
    const slot=current.players.findIndex(p=>p?.id===id);
    if(slot>=0)current.players[slot]=null;
    current.phase='lobby';current.epoch++;publish();
    status.textContent='A player left. Start a new match when everyone is ready.';
  }
  function watch(connection:DataConnection,onData:(data:any)=>void,onClose:()=>void) {
    pendingConnections.add(connection);
    const timeout=later(()=>{pendingConnections.delete(connection);if(!connection.open){onClose();connection.close();}},25000);
    connection.on('open',()=>{pendingConnections.delete(connection);clearTimeout(timeout);timers.delete(timeout);});
    connection.on('data',data=>{if(!closed)onData(data);});
    connection.on('close',()=>{pendingConnections.delete(connection);clearTimeout(timeout);timers.delete(timeout);if(!closed)onClose();});
    connection.on('error',()=>{connection.close();if(!closed)onClose();});
  }
  function accept(connection:DataConnection) {
    if(connection.label==='state' && current?.host===peer.id && guests.has(connection.peer)) {
      const link=guests.get(connection.peer)!;
      if(link.state || connection.metadata?.protocol!==PROTOCOL){connection.close();return;}
      link.state=connection;watch(connection,()=>{},()=>dropGuest(connection.peer,link));
      connection.on('open',()=>{const player=current?.players.find(p=>p?.id===connection.peer);if(player){player.ready=true;publish();}});return;
    }
    if(connection.label!=='control' || connection.metadata?.protocol!==PROTOCOL){connection.close();return;}
    let link:Link|undefined;
    watch(connection,data=>{
      if(!link || guests.get(connection.peer)!==link)return;
      link.seen=performance.now();
      if(data?.type==='ping'){send(connection,{type:'pong'});return;}
      if(data?.type!=='input' || current?.phase!=='playing')return;
      const now=performance.now();if(now-link.window>=1000){link.window=now;link.count=0;}
      if(++link.count>240)return;
      const slot=current.players.findIndex(p=>p?.id===connection.peer);
      const input=inputFromPeer(data.input,slot,current.epoch);if(input)onInput(input);
    },()=>{if(link)dropGuest(connection.peer,link);});
    connection.on('open',()=>{
      if(closed){connection.close();return;}
      const slot=current?.players.indexOf(null) ?? -1;
      const error=!current || current.host!==peer.id?'Room not found. Ask the host to create a room.':guests.has(connection.peer)?'Already joined this room.':current.phase!=='lobby'?'This match has started. Wait for the lobby.':slot<0?'This room is full (4 players).':undefined;
      if(error){send(connection,{type:'error',message:error});later(()=>connection.close(),1000);return;}
      link={control:connection,seen:performance.now(),window:0,count:0};guests.set(connection.peer,link);
      current!.players[slot]={id:connection.peer,slot,ready:false};publish();
    });
  }
  function initialize() {
    peer=new Peer(PROTOCOL+roomCode(),options);
    const active=peer;
    const startup=later(()=>{if(!closed && peer===active && !peer.open){status.textContent='Cannot reach the connection service. Check your internet or VPN, then click Retry Connection.';onReady(false);}},20000);
    peer.on('open',()=>{if(closed || peer!==active)return;clearTimeout(startup);timers.delete(startup);status.textContent='Connected. Create a room or join a six-character code.';onReady(true);});
    peer.on('connection',connection=>{if(closed || peer!==active)connection.close();else accept(connection);});
    peer.on('disconnected',()=>{
      if(closed || peer!==active)return;
      onReady(false);
      status.textContent='Signaling disconnected. Existing WebRTC connections can keep playing; reconnecting…';
      later(()=>{if(!closed && peer===active && peer.disconnected && !peer.destroyed)peer.reconnect();},3000);
    });
    peer.on('error',error=>{
      if(closed || peer!==active)return;
      clearTimeout(startup);timers.delete(startup);
      if(error.type==='unavailable-id' && !current && ++attempts<4){peer.destroy();initialize();return;}
      if(error.type==='peer-unavailable' && joining){loseHost('Room not found. Check the six-character code and that the host is online.');return;}
      if(joining){loseHost(`Could not reach the host (${error.type}). Keep the host tab open, then retry. If this repeats, try another network or turn off your VPN.`);return;}
      if(!peer.open)onReady(false);
      status.textContent=`Connection service error (${error.type}). Check your internet or VPN, then click Retry Connection.`;
    });
  }
  initialize();
  const heartbeat=setInterval(()=>{
    if(closed)return;
    const now=performance.now();
    if(hostLink && current){if(now-hostLink.seen>15000)loseHost('Host connection lost. Create or join a new room.');else send(hostLink.control,{type:'ping'});}
    for(const [id,link] of guests){if(now-link.seen>15000)dropGuest(id,link);else send(link.control,{type:'ping'});}
  },2000);
  return {
    get id(){return peer.id;},
    get connected(){return !closed && (peer.open || !!current);},
    get signalingReady(){return !closed && peer.open;},
    sendInput(input:unknown){send(hostLink?.control,{type:'input',input});},
    sendSnapshot(state:any){
      if(!current || current.host!==peer.id || current.phase!=='playing' || state.epoch!==current.epoch)return;
      const snapshot=structuredClone(state);
      for(const link of guests.values()) {
        // Separate unordered snapshots from reliable control/input. Drop stale state
        // before enqueueing if the WebRTC send buffer is congested.
        const c=link.state;
        if(c?.open && c.dataChannel.bufferedAmount<32768)send(c,{type:'snapshot',state:snapshot});
      }
    },
    request(event:string,data:unknown,reply:Reply) {
      if(closed || !peer.open){reply({error:'Still connecting to PeerJS signaling. Please wait or retry.'});return;}
      if(event==='create-room') {
        if(current || joining){reply({error:'Leave your current room first.'});return;}
        current={code:peer.id.slice(PROTOCOL.length),host:peer.id,phase:'lobby',epoch:0,players:[{id:peer.id,slot:0},null,null,null]};publish();reply({ok:true});
      } else if(event==='start-game') {
        if(!current || current.host!==peer.id){reply({error:'Only the host can start.'});return;}
        if(current.phase!=='lobby' || current.players.filter(Boolean).length<2){reply({error:'Wait for at least two players.'});return;}
        if([...guests.values()].some(link=>!link.state?.open)){reply({error:'Waiting for all WebRTC game channels to connect. Try Start again shortly.'});return;}
        current.phase='playing';current.epoch++;publish();reply({ok:true});
      } else if(event==='join-room') {
        const code=typeof data==='string'?data.trim().toUpperCase():'';
        if(!validCode(code)){reply({error:'Room not found. Enter the host’s six-character code.'});return;}
        if(current || joining){reply({error:'Leave your current room first.'});return;}
        if(PROTOCOL+code===peer.id){reply({error:'Create a room to host on this device.'});return;}
        joining=reply;
        const control=peer.connect(PROTOCOL+code,{label:'control',reliable:true,serialization:'json',metadata:{protocol:PROTOCOL}});
        const link:Link={control,seen:performance.now(),window:0,count:0};hostLink=link;
        watch(control,message=>{
          if(hostLink!==link)return;
          link.seen=performance.now();
          if(message?.type==='ping'){send(control,{type:'pong'});return;}
          if(message?.type==='error'){loseHost(String(message.message));return;}
          if(message?.type!=='room' || !validRoom(message.room,control.peer,peer.id))return;
          if(current && message.room.epoch<current.epoch)return;
          current=message.room;onRoom(structuredClone(current!));finishJoin();
          if(!link.state) {
            const state=peer.connect(control.peer,{label:'state',reliable:false,serialization:'binary',metadata:{protocol:PROTOCOL}});link.state=state;
            watch(state,data=>{
              if(hostLink!==link)return;
              if(data?.type==='snapshot' && current?.phase==='playing' && data.state?.epoch===current.epoch){link.seen=performance.now();onSnapshot(data.state);}
            },()=>{if(hostLink===link)loseHost('The game connection failed or closed. The host may still be online. Try a fresh invite or another network.');});
          }
        },()=>{if(hostLink===link)loseHost(joining?'Could not complete the connection. Keep the host tab open and retry. If it keeps failing, try home Wi-Fi or a phone hotspot.':'Connection to the host failed or closed. The host may still be online. Try a fresh invite or another network.');});
        joinTimer=later(()=>{if(hostLink===link && joining)loseHost('Connection timed out. Keep the host tab open and retry. Try home Wi-Fi or a phone hotspot if your network blocks multiplayer.');},25000);
      } else reply({error:'Unknown room request.'});
    },
    disconnect(){
      if(closed)return;closed=true;clearInterval(heartbeat);clearTimeout(joinTimer);timers.forEach(clearTimeout);timers.clear();
      hostLink?.state?.close();hostLink?.control.close();for(const link of guests.values()){link.state?.close();link.control.close();}
      pendingConnections.forEach(c=>c.close());pendingConnections.clear();guests.clear();current=null;peer.destroy();
    },
  };
}
