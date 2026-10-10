import assert from 'node:assert/strict';
import { SnapshotBuffer } from '../dist/snapshots.js';

function state(seq, sentAt, x, overrides={}) {
  return {seq,sentAt,generation:1,levelIndex:0,players:[{
    x,y:10,vx:100,vy:0,anim:x/10,rotation:0,flip:0,power:0,angle:0,swing:0,falling:0,
    ball:{x:x*2,y:20,vx:200,vy:0},
  }],...overrides};
}
const buffer=new SnapshotBuffer();
const a=state(1,1000,0), b=state(2,1040,4), c=state(3,1080,8);
buffer.push(a,0);buffer.push(b,75);buffer.push(c,80);
const before=JSON.stringify([a,b,c]);
const frames=[];
for(let i=0;i<20;i++)frames.push(buffer.sample(10));
const between=frames.filter(f=>f.players[0].x>0 && f.players[0].x<8);
assert.ok(between.length>=5,'renders multiple in-between frames despite bunched arrivals');
for(const f of between)assert.equal(f.players[0].ball.x,f.players[0].x*2,'ball and player share timeline');
for(let i=1;i<frames.length;i++)assert.ok(frames[i].players[0].x>=frames[i-1].players[0].x,'never runs backwards');
assert.equal(JSON.stringify([a,b,c]),before,'rendering never mutates authoritative snapshots');
assert.equal(buffer.push(b,100),false,'duplicate ignored');
assert.equal(buffer.push(state(0,2000,50),100),false,'stale sequence ignored');
assert.equal(buffer.push(state(4,1001,50),100),false,'stale timestamp ignored');
for(let i=0;i<300;i++)assert.equal(buffer.sample(16).players[0].x,8,'packet loss freezes rather than extrapolating');
buffer.push(state(4,5000,80),5000);
assert.equal(buffer.sample(0).players[0].x,80,'long outage re-primes buffer');
buffer.push(state(5,5040,0,{generation:2}),5040);
assert.equal(buffer.sample(0).players[0].x,0,'same-level restart clears old positions');
buffer.push(state(6,5080,150,{generation:2,levelIndex:1}),5080);
assert.equal(buffer.sample(0).players[0].x,150,'level change snaps to new world');
buffer.clear();
assert.equal(buffer.sample(16),undefined);
assert.equal(buffer.push(state(1,0,0),0),true,'new epoch can restart numbering');

// Independent respawns never lerp across the map; the other body still interpolates.
for(const body of ['player','ball']) {
  buffer.clear();
  const old=state(1,1000,100), next=state(2,1040,104);
  if(body==='player') {next.players[0].revision=1;next.players[0].x=0;}
  else {next.players[0].ball.revision=1;next.players[0].ball.x=0;}
  buffer.push(old,0);buffer.push(next,40);
  const samples=Array.from({length:35},()=>buffer.sample(5));
  assert.ok(samples.some(s=>s.seq===2));
  for(const s of samples.filter(s=>s.seq===1)) {
    assert.equal(body==='player'?s.players[0].x:s.players[0].ball.x,body==='player'?100:200);
  }
}
console.log('Snapshot tests passed: jitter, interpolation, immutability, ordering, loss, recovery, restart, level change, independent respawns.');
