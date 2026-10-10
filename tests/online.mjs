import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({headless:true, ...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})});
const pages=[], errors=[];
async function page() {
  const p=await browser.newPage({viewport:{width:1440,height:1100}});pages.push(p);
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/dist/main.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`
const netStats={snapshots:0,packetWrites:0,physics:0,ballPhysics:0,frames:[],capture:false,jitter:false,delivered:0};
const originalReceiveSnapshot=receiveSnapshot;
receiveSnapshot=state=>{
  netStats.snapshots++;
  const deliver=()=>{const before=players;originalReceiveSnapshot(state);netStats.delivered++;if(players!==before)netStats.packetWrites++;};
  if(netStats.jitter)setTimeout(deliver,[80,0,35][netStats.snapshots%3]);else deliver();
};
const originalMovePlayer=movePlayer;movePlayer=(...args)=>{netStats.physics++;return originalMovePlayer(...args);};
const originalMoveBall=moveBall;moveBall=(...args)=>{netStats.ballPhysics++;return originalMoveBall(...args);};
const originalRender=render;render=(poses=players)=>{if(netStats.capture)netStats.frames.push({x:poses[0]?.x,own:poses[1]?.x,at:performance.now()});return originalRender(poses);};
const originalReceiveInput=receiveInput;receiveInput=data=>{if(netStats.inputDelay)setTimeout(()=>originalReceiveInput(data),netStats.inputDelay);else originalReceiveInput(data);};
window.netStats=netStats;
window.onlineTest={get players(){return players},get room(){return room},get aims(){return aims},get slots(){return onlineSlots},get winner(){return winner},get level(){return levelIndex},get inputSeq(){return inputSeq},get acknowledged(){return acknowledged},sendInput,win};`});});
  await p.goto(process.env.TEST_URL || 'http://localhost:5173');await p.click('#play-online');
  await p.waitForFunction(()=>document.querySelector('#online-status').textContent.startsWith('Connected.'));
  return p;
}
try {
  const a=await page();await a.click('#create-room');await a.waitForFunction(()=>window.onlineTest.room);
  const code=await a.evaluate(()=>window.onlineTest.room.code);
  assert.equal(await a.locator('#start-game').isDisabled(),true);
  const b=await page();await b.fill('#room-code','0000');await b.click('#join-room');await b.waitForFunction(()=>document.querySelector('#online-status').textContent.includes('not found'));
  for(const p of [b,await page(),await page()]){await p.fill('#room-code',code);await p.click('#join-room');await p.waitForFunction(()=>window.onlineTest.room);}
  await a.waitForFunction(()=>window.onlineTest.room.players.filter(Boolean).length===4);
  await a.screenshot({path:'artifacts/online-lobby.png'});
  await a.click('#start-game');for(const p of pages)await p.waitForFunction(()=>window.onlineTest.players.length===4 && window.onlineTest.room.phase==='playing');
  const positions=await a.evaluate(()=>window.onlineTest.players.map(p=>p.x));
  await b.keyboard.down('KeyD');await b.waitForTimeout(350);await b.keyboard.up('KeyD');
  await a.waitForFunction(x=>window.onlineTest.players[1].x>x+20,positions[1]);
  assert.equal(await a.evaluate(()=>window.onlineTest.players[0].x),positions[0]);
  await b.keyboard.press('KeyW');await b.waitForTimeout(70);await b.keyboard.press('KeyW');
  await a.waitForFunction(()=>window.onlineTest.players[1].jumps===2);
  await a.click('#restart');await b.waitForTimeout(200);
  // CSS-scaled cursor coordinates must be converted back to world coordinates.
  const box=await b.locator('#game').boundingBox();
  await b.mouse.move(box.x+box.width*.6,box.y+box.height*.3);
  await b.mouse.down();await b.waitForTimeout(300);await b.mouse.up();
  await a.waitForFunction(()=>window.onlineTest.players[1].strokes===1);
  assert.equal(await a.evaluate(()=>window.onlineTest.players[0].strokes),0);
  assert.ok(Math.abs(await a.evaluate(()=>window.onlineTest.aims[1].x)-768)<2);
  await b.waitForFunction(()=>window.onlineTest.players[1].strokes===1);
  await a.evaluate(()=>window.onlineTest.win(3));await b.waitForFunction(()=>window.onlineTest.winner===3);
  assert.match(await b.locator('#winner').textContent(),/P4/);
  await a.click('#again');await b.waitForFunction(()=>window.onlineTest.level===1);
  await a.screenshot({path:'artifacts/online-game.png'});
  // Exercise actual browser renders under delayed, bunched and out-of-order delivery.
  await b.evaluate(()=>{window.netStats.jitter=true;window.netStats.capture=true;window.netStats.frames=[];});
  const packetsBefore=await b.evaluate(()=>window.netStats.snapshots);
  await a.keyboard.down('KeyD');await b.waitForTimeout(650);await a.keyboard.up('KeyD');await b.waitForTimeout(250);
  const network=await b.evaluate(()=>({...window.netStats,frames:window.netStats.frames}));
  const changes=network.frames.slice(1).filter((f,i)=>Math.abs(f.x-network.frames[i].x)>.01).length;
  assert.ok(changes>network.snapshots-packetsBefore,'rendered movement has more steps than incoming snapshots');
  assert.equal(network.packetWrites,0,'packet handlers never overwrite rendered positions');
  assert.equal(network.physics,0,'joining clients never simulate players');
  assert.equal(network.ballPhysics,0,'joining clients never simulate balls');
  assert.ok(network.snapshots-packetsBefore>=15 && network.snapshots-packetsBefore<=30,'bounded state update rate');
  // Delay guest input delivery: local feedback must appear before host movement.
  await b.evaluate(()=>{window.netStats.capture=false;window.netStats.jitter=false;});
  await a.click('#restart');await b.waitForTimeout(250);
  const initial=await a.evaluate(()=>window.onlineTest.players[1].x);
  await a.evaluate(()=>{window.netStats.inputDelay=200;});
  await b.evaluate(()=>{window.netStats.frames=[];window.netStats.capture=true;window.onlineTest.sendInput('right',true);});
  await b.waitForTimeout(60);
  assert.equal(await a.evaluate(()=>window.onlineTest.players[1].x),initial,'host has not received delayed input yet');
  assert.ok(await b.evaluate(x=>window.netStats.frames.some(f=>f.own>x+1),initial),'own movement feedback is immediate');
  await b.evaluate(()=>window.onlineTest.sendInput('right',false));await b.waitForTimeout(450);
  await a.evaluate(()=>{window.netStats.inputDelay=0;});

  await pages[2].close();await a.waitForFunction(()=>window.onlineTest.room.phase==='lobby');
  const replacement=await page();await replacement.fill('#room-code',code);await replacement.click('#join-room');
  await replacement.waitForFunction(()=>window.onlineTest.room?.players[2]?.id);
  assert.match(await replacement.locator('#your-player').textContent(),/PLAYER 3/);
  await a.click('#leave-online');await a.click('#play');
  await a.keyboard.down('ArrowRight');await a.waitForTimeout(150);await a.keyboard.up('ArrowRight');
  assert.equal(await a.evaluate(()=>window.onlineTest.players.length),2);
  assert.deepEqual(errors,[]);
  console.log('Online browser tests passed: four clients, lobby, movement ownership, double jump, mouse world aim, own-ball swing, P4 win, level sync, disconnect/rejoin, return to local.');
} finally { await browser.close(); }

