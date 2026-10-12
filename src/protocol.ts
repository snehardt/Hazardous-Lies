export type Room = { code:string; host:string; phase:'lobby'|'playing'; epoch:number; players:({id:string;slot:number;ready?:boolean}|null)[] };
export const PROTOCOL='hazardous-lies-v3-';
export function roomCode() {
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>alphabet[n%32]).join('');
}
export function validCode(code:unknown):code is string {return typeof code==='string' && /^[A-HJ-NP-Z2-9]{6}$/.test(code);}
export function validRoom(value:any,host:string,self:string):value is Room {
  return value?.host===host && validCode(value.code) && host===PROTOCOL+value.code && ['lobby','playing'].includes(value.phase) && Number.isSafeInteger(value.epoch) && value.epoch>=0 && Array.isArray(value.players) && value.players.length===4 && value.players[0]?.id===host && value.players.every((p:any,i:number)=>p===null || p?.slot===i && typeof p.id==='string') && value.players.some((p:any)=>p?.id===self) && new Set(value.players.filter(Boolean).map((p:any)=>p.id)).size===value.players.filter(Boolean).length;
}
// Identity comes from the admitted WebRTC channel, never the message payload.
export function inputFromPeer(data:any,slot:number,epoch:number) {
  if(!data || data.epoch!==epoch || !['movement','left','right','jump','recall','swing','aim','clear'].includes(data.action))return;
  if(!Number.isSafeInteger(data.generation) || data.generation<0)return;
  if(data.action==='movement') {
    if(!Array.isArray(data.frames) || data.frames.length<1 || data.frames.length>12 || data.frames.some((f:any)=>!Number.isSafeInteger(f?.tick) || f.tick<1 || ['left','right','jump'].some(k=>typeof f[k]!=='boolean')))return;
    return {slot,epoch,action:data.action,generation:data.generation,frames:data.frames.map(({tick,left,right,jump}:any)=>({tick,left,right,jump}))};
  }
  if(data.action==='aim' && (!Number.isFinite(data.x) || !Number.isFinite(data.y)))return;
  if(!['aim','clear'].includes(data.action) && typeof data.down!=='boolean')return;
  return {slot,epoch,action:data.action,generation:data.generation,seq:Number.isSafeInteger(data.seq)?data.seq:0,down:data.down,x:Math.max(-1280,Math.min(2560,data.x||0)),y:Math.max(-640,Math.min(1280,data.y||0))};
}
