import assert from 'node:assert/strict';
import { RoomRelay } from '../relay/room.mjs';
import worker from '../relay/worker.mjs';

const socket=()=>({messages:[],send(value){this.messages.push(JSON.parse(value));},close(code){this.closed=code;},serializeAttachment(value){this.attachment=structuredClone(value);}});
const relay=new RoomRelay(), host=socket(), guest=socket(), third=socket(), fourth=socket();
const message=(s,value)=>relay.message(s,JSON.stringify(value));
const empty=socket();assert.equal(relay.add(empty,'ABCD23','join'),false);assert.match(empty.messages[0].message,/not found/);
assert.equal(relay.add(host,'ABCD23','create'),true);
message(host,{type:'start',request:1});assert.match(host.messages.at(-1).error,/two players/);
relay.add(guest,'ABCD23','join');relay.add(third,'ABCD23','join');relay.add(fourth,'ABCD23','join');
const extra=socket();assert.equal(relay.add(extra,'ABCD23','join'),false);assert.match(extra.messages[0].message,/full/);
message(guest,{type:'start',request:2});assert.match(guest.messages.at(-1).error,/Only the host/);
message(host,{type:'start',request:3});assert.equal(relay.room.phase,'playing');
const late=socket();assert.equal(relay.add(late,'ABCD23','join'),false);assert.match(late.messages[0].message,/started/);
message(guest,{type:'input',input:{slot:0,epoch:1,generation:0,action:'right',down:true}});
assert.equal(host.messages.at(-1).input.slot,1,'guest cannot impersonate host');
const before=host.messages.length;message(guest,{type:'input',input:{epoch:0,generation:0,action:'right',down:true}});assert.equal(host.messages.length,before,'reject stale epoch');
const count=third.messages.length;message(guest,{type:'snapshot',state:{epoch:1}});assert.equal(third.messages.length,count,'guest cannot publish world state');
message(host,{type:'snapshot',state:{epoch:1,seq:5}});assert.equal(third.messages.at(-1).state.seq,5);
const restored=new RoomRelay();for(const s of [host,guest,third,fourth])restored.restore(s,s.attachment);
assert.deepEqual(restored.room,relay.room,'room survives hibernation');
restored.remove(third);assert.equal(restored.room.phase,'lobby');assert.equal(restored.room.epoch,2);assert.equal(restored.room.players[2],null);
const replacement=socket();restored.add(replacement,'ABCD23','join');assert.equal(restored.clients.get(replacement).slot,2);
restored.remove(host);assert.equal(restored.room,null);assert.equal(guest.closed,1000);assert.equal(restored.clients.size,0);
for(const path of ['/health','/rooms/ABCD23']) {
  const response=await worker.fetch(new Request('https://relay.example'+path,{headers:{Origin:'https://other.example'}}),{});
  assert.equal(response.status,path==='/health'?200:403);
}
const env={ALLOWED_ORIGINS:'https://snehardt.github.io'};
assert.equal((await worker.fetch(new Request('https://relay.example/rooms/ABCD23',{headers:{Origin:env.ALLOWED_ORIGINS}}),env)).status,426);
console.log('Relay tests passed: capacity, membership, authority, epoch, hibernation, host departure, origins.');
