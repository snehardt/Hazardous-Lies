import assert from 'node:assert/strict';
import {MovementPrediction,MovementQueue,MOVEMENT_STEP as dt} from '../dist/prediction.js';

const step=(p,c)=>{p.x+=c.right?1:c.left?-1:0;if(c.jump)p.jumps++;};
const predicted=new MovementPrediction(p=>({...p}),step),queue=new MovementQueue();
const host={x:0,jumps:0};
predicted.reconcile(host,0);
let packets=[],snapshots=[];
for(let tick=1;tick<=360;tick++) {
  const input={left:tick>180 && tick<=240,right:tick<=120,jump:tick===40 || tick===49};
  predicted.advance(input);
  if(tick%4===0)packets.push({at:tick+12,frames:predicted.drain()});
  for(const packet of packets.filter(p=>p.at===tick))queue.push(packet.frames);
  packets=packets.filter(p=>p.at>tick);
  queue.advance(dt,c=>step(host,c));
  if(tick%5===0)snapshots.push({at:tick+8,pose:{...host},ack:queue.acknowledged});
  for(const snapshot of snapshots.filter(s=>s.at===tick))predicted.reconcile(snapshot.pose,snapshot.ack);
  snapshots=snapshots.filter(s=>s.at>tick);
  // Replaying all unacknowledged commands must never pull prediction backwards.
  const expected=tick<=120?tick:tick<=180?120:tick<=240?300-tick:60;
  assert.equal(predicted.pose.x,expected,`continuous movement at tick ${tick}`);
}
assert.equal(predicted.pose.jumps,2,'jump taps survive batching');
assert.equal(host.jumps,2,'host executes jumps only once');
assert.equal(host.x,60,'host converges');
queue.push([{tick:1,left:false,right:true,jump:true}]);
queue.advance(dt,c=>step(host,c));assert.equal(host.jumps,2,'duplicate input cannot jump twice');
const bounded=new MovementQueue();
bounded.push(Array.from({length:120},(_,i)=>({tick:i+1,left:false,right:true,jump:false})));
let count=0;bounded.advance(dt,()=>count++);assert.equal(count,1,'client cannot choose simulation dt or outrun host time');
predicted.clear();predicted.reconcile({x:500,jumps:0},0);assert.equal(predicted.pose.x,500,'reset drops history');
const stalled=new MovementQueue();let neutral=0;
for(let tick=0;tick<120;tick++)stalled.advance(dt,()=>{},()=>neutral++);
assert.ok(neutral>=89 && neutral<=91,'long input stalls still advance neutral host movement');
console.log('Prediction passed: immediate movement, delayed acknowledgement/replay, no backwards reconciliation, jump taps, duplicates, authority rate limit, resets.');
