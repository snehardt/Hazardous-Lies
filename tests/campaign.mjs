import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({headless:true, ...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})});
const page = await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.requestAnimationFrame=()=>0});
await page.route('**/dist/main.js',async route=>{
 const response=await route.fetch();
 await route.fulfill({response,body:(await response.text())+'\nwindow.testGame={get players(){return players}, get winner(){return winner}, get platforms(){return platforms},get hole(){return hole},get levelIndex(){return levelIndex},levels,scores,results,keys,reset,loadLevel,newMatch,update,moveBall,movePlayer,jump,hitDown,hitUp,shotSpeed,roundedContact,render,win,recallClear,releaseMagnet,moveMagnet,routeDistance,magnetAngle,trackBall,respawnBall};'});
});
try {
 await page.goto('http://localhost:5173');
 await page.waitForFunction(()=>!!window.testGame);
 await page.evaluate(()=>document.fonts.ready);
 await mkdir('artifacts/levels',{recursive:true});
 await page.click('#play');
 assert.equal(await page.locator('#start').isVisible(),false);
 assert.equal(await page.locator('#level-select option').count(),10);
 assert.equal(await page.evaluate(()=>window.testGame.levels.filter(l=>l.idea.includes('three stacked fairways')).length),1,'Only one S course');
 const checks=await page.evaluate(()=>{
  const t=window.testGame, dt=1/120, checks={};
  t.newMatch(); const p=t.players[0];
  t.keys.add('KeyD'); for(let j=0;j<20;j++) t.update(dt); t.keys.clear();
  checks.movement=p.x>t.levels[0].start.x+10;
  t.jump(p,0); t.update(dt); t.jump(p,0); checks.doubleJump=p.jumps===2;
  t.reset(); t.hitDown(0); checks.set=t.players[0].set;
  t.hitDown(0); for(let j=0;j<60;j++)t.update(dt); t.hitUp(0); checks.charge=t.players[0].strokes===1 && t.players[0].ball.vx>300;
  t.reset();t.hitDown(1);t.hitDown(1);for(let j=0;j<30;j++)t.update(dt);t.hitUp(1);checks.blueShot=t.players[1].strokes===1;
  t.reset(); const golfer=t.players[1], ball=t.players[0].ball;
  ball.x=golfer.x-26;ball.y=golfer.y;ball.vx=600;ball.vy=0;
  t.moveBall(ball,dt,0);checks.bonk=golfer.tumble&&golfer.vy<-250&&ball.vx<0;
  t.reset(); const a=t.players[0];a.grounded=false;a.coyote=0;a.jumps=2;a.wall=1;t.jump(a,0);checks.wallJump=a.vx<0&&a.vy<0;
  const resets=[];
  for(let i=0;i<10;i++) {
   t.loadLevel(i); const level=t.levels[i], player=t.players[0], b=player.ball, other=t.players[1];
   for(let j=0;j<120;j++)t.update(dt);
   if(Math.abs(player.x-level.start.x)>1||Math.abs(b.x-(level.start.x+28))>1||!player.grounded||!b.grounded)throw new Error('Unstable start '+level.name);
   const h=level.hazards[0]; const otherX=other.x, ownBallX=b.x;
   player.x=h.x+h.w/2;player.y=h.y;player.vx=player.vy=0;
   t.movePlayer(player,dt,0);
   const began=player.falling===1;
   for(let j=0;j<60;j++)t.movePlayer(player,dt,0);
   const delayed=player.falling>.4&&Math.abs(player.x-level.start.x)>1;
   for(let j=0;j<60;j++)t.movePlayer(player,dt,0);
   const respawn=player.falling===0&&player.x===level.start.x&&other.x===otherX&&b.x===ownBallX;
   b.x=h.x+h.w/2;b.y=h.y;b.vx=b.vy=0;t.moveBall(b,dt,0);
   const ballBegan=b.falling===1;
   for(let j=0;j<60;j++)t.moveBall(b,dt,0);
   const ballDelayed=b.falling>.4;
   for(let j=0;j<60;j++)t.moveBall(b,dt,0);
   const ballRespawn=b.falling===0&&b.x===level.start.x+28&&player.x===level.start.x;
   resets.push(began&&delayed&&respawn&&ballBegan&&ballDelayed&&ballRespawn);
   t.reset();
   const sand=t.platforms.find(s=>s.sand&&!s.slope); const sb=t.players[0].ball;
   t.players.forEach(p=>{p.x=15;p.y=80});
   sb.x=sand.x+sand.w/2;sb.y=sand.y-13;sb.vx=600;sb.vy=500;sb.grounded=false;
   t.moveBall(sb,dt,0);
   if(sb.vx!==0||sb.vy!==0||!sb.grounded)throw new Error('Sand catch failed '+level.name);
   if(Math.abs(t.shotSpeed(t.players[0],1)-1040*.8)>.01)throw new Error('Sand power failed '+level.name);
   // Capture at each real hole and ensure repeated scoring cannot add extra points.
   t.reset();const hb=t.players[0].ball;hb.x=t.hole.x;hb.y=t.hole.y-9;hb.vx=hb.vy=0;
   t.moveBall(hb,dt,0);
   if(t.winner!==0)throw new Error('Inaccessible goal '+level.name);
   const score=t.scores[0];t.win(0);if(t.scores[0]!==score)throw new Error('Duplicate point');
  }
  checks.allResets=resets.every(Boolean);checks.tenPoints=t.scores[0]===10;
  t.loadLevel(0);t.win(1);checks.replayReplaces=t.scores[0]===9&&t.scores[1]===1;
  t.loadLevel(1); checks.scorePersists=t.scores[0]===9&&t.scores[1]===1;
  // Close golfers can strike a tunnel ball without teleporting into the tunnel.
  t.loadLevel(1);const tp=t.players[0],tb=tp.ball;tp.x=312;tp.y=516;tb.x=360;tb.y=531;tp.grounded=tb.grounded=true;
  t.hitDown(0);checks.tunnelShotWithoutTeleport=tp.set&&tp.x===312;tp.set=false;
  // The mountain tunnel carries the ball but stops the golfer at its entrance.
  tp.x=280;tp.y=516;tp.vx=265;t.keys.add('KeyD');for(let j=0;j<90;j++)t.movePlayer(tp,dt,0);t.keys.clear();checks.playerTunnelBlocked=tp.x<330;
  tp.x=20;tp.y=150;tb.x=310;tb.y=531;tb.vx=650;tb.vy=0;tb.grace=.2;tb.resting=false;
  for(let j=0;j<360;j++)t.moveBall(tb,dt,0);checks.ballTunnel=tb.x>830&&tb.grounded;
  t.newMatch();checks.newMatch=t.scores.every(s=>s===0)&&t.results.every(r=>r===null)&&t.levelIndex===0;
  return checks;
 });
 for(const [name,passed] of Object.entries(checks))assert.equal(passed,true,name);
 const regressions=await page.evaluate(()=>{
  const t=window.testGame,dt=1/120,out={};
  // Actual keyboard-style movement through both resting balls cannot displace either.
  t.loadLevel(0);const initial=t.players.map(p=>({x:p.ball.x,y:p.ball.y}));
  t.keys.add('KeyD');for(let i=0;i<65;i++)t.update(dt);t.keys.clear();
  out.noPushing=t.players.every((p,i)=>p.ball.x===initial[i].x&&p.ball.y===initial[i].y);
  // A ball that settles after a real landing is just as immovable as the tee balls.
  t.reset();t.players.forEach(p=>{p.x=1000;p.y=80});const landed=t.players[0].ball;
  landed.x=210;landed.y=260;landed.vx=landed.vy=0;landed.resting=false;landed.grounded=false;
  for(let frame=0;frame<900&&!landed.resting;frame++)t.moveBall(landed,dt,0);
  const landingX=landed.x,landingY=landed.y;
  t.players[0].x=150;t.players[0].y=306;t.players[0].grounded=true;
  t.keys.add('KeyD');for(let frame=0;frame<45;frame++)t.update(dt);t.keys.clear();
  out.landedBallStaysPut=landed.resting&&landed.x===landingX&&landed.y===landingY;
  // Even a slow, unsettled ball ignores a golfer rather than being pushed out of overlap.
  t.reset();const slow=t.players[0].ball,sp=t.players[0];slow.resting=false;slow.vx=20;slow.x=sp.x;const before=slow.x;
  t.moveBall(slow,dt,0);out.slowNoShove=Math.abs(slow.x-before)<1;
  // Aim underneath the mountain roof, while standing at its entrance, in both directions.
  t.loadLevel(1);let p=t.players[0],b=p.ball;p.x=312;p.y=516;b.x=360;b.y=531;
  t.hitDown(0);p.facing=-1;t.movePlayer(p,dt,0);out.lowRoofAim=p.set&&p.x===312;
  p.charging=true;p.power=.4;t.hitUp(0);out.lowRoofHit=b.vx<0&&p.strokes===1;
  // Walk every real ramp in both directions, checking every frame for surface following.
  const failures=[];
  for(let level=0;level<10;level++) {
   t.loadLevel(level);const ramps=t.platforms.filter(s=>s.slope);
   for(const ramp of ramps)for(const dir of [-1,1]) {
    p=t.players[0];t.reset();p=t.players[0];
    const sx=dir>0?ramp.x+20:ramp.x+ramp.w-20;
    p.x=sx;p.y=ramp.y+ramp.slope*(sx-ramp.x)/ramp.w-24;p.grounded=true;p.vx=dir*265;
    t.keys.add(dir>0?'KeyD':'KeyA');
    for(let frame=0;frame<240;frame++) {
     t.movePlayer(p,dt,0);
     if(p.x<ramp.x+5||p.x>ramp.x+ramp.w-5)break;
     const surface=ramp.y+ramp.slope*(p.x-ramp.x)/ramp.w;
     if(p.y+24>surface+2||p.falling) { failures.push({level:level+1,x:p.x,surface,foot:p.y+24});break; }
    }
    t.keys.clear();
   }
   // Every horizontal pixel along the bottom has physical land or water, not background.
   for(let x=0;x<1280;x++) {
    const ground=t.platforms.some(s=>x>=s.x&&x<=s.x+s.w&&s.y+Math.max(0,s.slope||0)+s.h>=640);
    const water=t.levels[level].hazards.some(h=>h.kind==='water'&&x>=h.x&&x<=h.x+h.w&&h.y+h.h>=640);
    if(!ground&&!water)throw new Error('Empty bottom at '+level+':'+x);
   }
   if(t.platforms.some(s=>!s.purpose))throw new Error('Unassigned platform purpose');
  }
  out.rampWalking=failures.length===0;if(failures.length)console.log(failures);
  out.connectedBottom=true;
  // A ball resting at the join of two steep slopes is hittable without moving the golfer.
  t.loadLevel(6);p=t.players[0];b=p.ball;p.x=322;p.y=516;b.x=325;b.y=531;b.resting=true;
  const px=p.x,py=p.y;t.hitDown(0);p.angle=Math.PI*.48;p.charging=true;p.power=1;t.hitUp(0);
  for(let i=0;i<18;i++)t.moveBall(b,dt,0);
  out.cornerEscape=p.strokes===1&&p.x===px&&p.y===py&&b.y<510;
  // The rebuilt level ten bowl also permits an immediate escape shot from its ramp join.
  t.loadLevel(9);p=t.players[0];b=p.ball;p.x=905;p.y=296;b.x=940;b.y=311;b.resting=true;
  t.hitDown(0);p.angle=Math.PI*.48;p.charging=true;p.power=1;t.hitUp(0);
  for(let frame=0;frame<18;frame++)t.moveBall(b,dt,0);
  out.levelTenCornerEscape=p.strokes===1&&p.x===905&&b.x!==940;
  // Wall corners also allow shots directed away from the obstruction.
  t.loadLevel(8);p=t.players[0];b=p.ball;p.x=185;p.y=536;b.x=216;b.y=551;b.resting=true;
  t.hitDown(0);p.facing=-1;p.charging=true;p.power=.55;t.hitUp(0);for(let i=0;i<20;i++)t.moveBall(b,dt,0);
  out.wallCornerEscape=p.strokes===1&&b.x<200;
  // A legitimate travelling ball can wake another ball; golfers still cannot.
  t.loadLevel(0);t.players.forEach(p=>{p.x=20;p.y=90});
  const ba=t.players[0].ball,bb=t.players[1].ball;ba.x=100;ba.y=321;ba.resting=false;ba.vx=600;bb.x=120;bb.y=321;
  t.update(dt);out.ballInterference=!bb.resting&&bb.vx>100;
  t.newMatch();return out;
 });
 console.log('Regressions:',regressions);
 for(const [name,passed]of Object.entries(regressions))assert.equal(passed,true,name);
 const topAndPassages=await page.evaluate(()=>{
  const t=window.testGame,out={};t.loadLevel(3);
  const shelves=t.platforms.filter(s=>s.purpose.includes('climbing shelf')||s.purpose.includes('Upper sand shelf')||s.purpose.includes('Upper fairway launching'));
  out.wideTowerPassages=shelves.length===3&&shelves[1].x-(shelves[0].x+shelves[0].w)>=80&&shelves[1].x-(shelves[2].x+shelves[2].w)>=80;
  out.fullTowerHeadroom=500-(shelves[0].y+shelves[0].h)>=76&&shelves[0].y-(shelves[1].y+shelves[1].h)>=76&&shelves[1].y-(shelves[2].y+shelves[2].h)>=76;
  // Verify every intended lift, rather than accepting a shortcut to the cup.
  for(const [x,foot,left,right,top] of [[970,500,620,920,360],[900,360,1000,1140,220],[1015,220,500,920,80]]) {
   let reached=false;
   for(const dir of [-1,1])for(const delay of [.12,.2,.28,.35,.42,.5]) {
    const p={...t.players[0],x,y:foot-24,grounded:true,vx:0,vy:0,jumps:0};t.keys.clear();t.keys.add(dir<0?'KeyA':'KeyD');t.jump(p,0);
    for(let frame=0;frame<360;frame++) {
     if(frame===Math.round(delay*120))t.jump(p,0);t.movePlayer(p,1/120,0);
     if(p.grounded&&Math.abs(p.y+24-top)<1&&p.x>left+13&&p.x<right-13){reached=true;break;}
     if(p.falling)break;
    }
    if(reached)break;
   }
   out['towerLiftTo'+top]=reached;
  }
  out.noSolidCeilings=!t.levels.some(l=>l.platforms.some(s=>s.purpose.toLowerCase().includes('ceiling')));
  for(const owner of [0,1]) {
   t.loadLevel(8);const p=t.players[owner],b=p.ball;p.x=700;p.y=40;p.vy=-1500;p.grounded=false;
   t.movePlayer(p,.1,owner);out['golferTop'+owner]=p.y>=30&&p.vy>=0;
   p.y=40;p.vy=-1500;p.flip=.4;t.movePlayer(p,.04,owner);out['flipTop'+owner]=p.y>=38;
   p.y=40;p.vy=-1500;p.flip=0;p.tumble=true;t.movePlayer(p,.04,owner);out['bonkTop'+owner]=p.y>=38;
   b.x=700;b.y=15;b.vx=0;b.vy=-1500;b.resting=false;t.moveBall(b,.04,owner);out['ballTop'+owner]=b.y>=9&&b.vy>0;
  }
  t.newMatch();return out;
 });
 console.log('Top boundary and tower gaps:',topAndPassages);for(const [name,passed]of Object.entries(topAndPassages))assert.equal(passed,true,name);
 const magnet=await page.evaluate(()=>{
  const t=window.testGame,dt=1/120,out={};
  const prepare=(owner=0,roof=false)=>{
   t.loadLevel(1);t.players[1-owner].x=25;t.players[1-owner].y=516;
   const p=t.players[owner],b=p.ball;p.x=250;p.y=516;p.grounded=true;
   b.x=530;b.y=roof?251:531;b.vx=b.vy=0;b.resting=true;b.grounded=true;
   return {p,b,key:owner===0?'KeyS':'ArrowDown'};
  };
  let {p,b,key}=prepare();t.keys.add(key);
  for(let frame=0;frame<70;frame++)t.update(dt);
  out.halfSecondVisible=p.magnetHold>=.5&&!p.magnetActive&&b.x===530;
  t.keys.clear();t.update(dt);out.earlyRelease=p.magnetHold===0&&!p.magnetActive&&b.x===530;
  ({p,b,key}=prepare());t.keys.add(key);for(let frame=0;frame<125;frame++)t.update(dt);
  out.oneSecondPull=p.magnetActive&&b.x<530&&p.magnetSpeed<70;
  const firstSpeed=p.magnetSpeed;for(let frame=0;frame<35;frame++)t.update(dt);
  out.acceleration=p.magnetActive&&p.magnetSpeed>firstSpeed+80;
  for(let frame=0;frame<250&&!p.tumble;frame++)t.update(dt);
  out.ownerBonk=p.tumble&&p.vy<-250&&!p.magnetActive&&b.x<330;
  // The same held key cannot repeatedly arm the magnet after an arrival.
  p.tumble=false;p.vx=p.vy=0;p.x=250;p.y=516;
  for(let frame=0;frame<260;frame++)t.update(dt);
  out.oneRecallPerHold=!p.magnetActive&&p.magnetHold===0;
  t.keys.clear();t.update(dt);out.releaseRearms=!p.magnetUsed;
  ({p,b,key}=prepare());b.resting=false;b.vx=300;t.keys.add(key);for(let frame=0;frame<250;frame++){b.x=530;b.y=531;b.vx=300;b.vy=0;b.resting=false;t.update(dt);}
  out.movingBallRejected=p.magnetHold===0&&!p.magnetActive;
  ({p,b,key}=prepare());b.x=100;t.keys.add(key);for(let frame=0;frame<260;frame++)t.update(dt);
  out.behindBallRejected=p.magnetHold===0&&!p.magnetActive&&b.x===100;
  t.loadLevel(0);p=t.players[0];b=p.ball;p.x=800;p.y=206;b.x=1000;b.y=381;b.resting=true;
  const ballDirect=Math.hypot(b.x-t.hole.x,b.y-t.hole.y), playerDirect=Math.hypot(p.x-t.hole.x,p.y-t.hole.y);
  out.terrainRouteComparison=ballDirect<playerDirect&&t.routeDistance(b.x,b.y)>t.routeDistance(p.x,p.y+15);
  t.keys.add('KeyS');for(let frame=0;frame<150;frame++)t.update(dt);
  out.lowerFairwayRejected=p.magnetHold===0&&!p.magnetActive;
  ({p,b,key}=prepare());const other=t.players[1];other.x=365;other.y=516;t.keys.add(key);
  for(let frame=0;frame<300&&!other.tumble;frame++)t.update(dt);
  out.opponentBonk=other.tumble&&other.vy<-250&&other.vx<0&&p.magnetActive;
  b.x=p.x+100;b.y=p.y+6;out.magnetPointsRight=Math.abs(t.magnetAngle(p))<.01;
  b.x=p.x-100;out.magnetPointsLeft=Math.abs(Math.abs(t.magnetAngle(p))-Math.PI)<.01;
  b.x=p.x;b.y=p.y-94;out.magnetPointsUp=Math.abs(t.magnetAngle(p)+Math.PI/2)<.01;
  // A phase recall travels through mountain rock, and release cannot leave it inside that rock.
  ({p,b,key}=prepare(0,true));t.keys.add(key);let crossedRock=false;
  for(let frame=0;frame<500;frame++){
   t.update(dt);if(p.magnetActive&&!t.recallClear(b.x,b.y)){crossedRock=true;break;}
  }
  out.throughWall=crossedRock;
  t.keys.clear();t.update(dt);out.safeWallRelease=!p.magnetActive&&t.recallClear(b.x,b.y);
  ({p,b,key}=prepare(1));t.keys.add(key);for(let frame=0;frame<125;frame++)t.update(dt);
  out.blueMagnet=p.magnetActive&&b.x<530;
  t.reset();p=t.players[0];b=p.ball;t.hitDown(0);const oldAngle=p.angle;t.keys.add('KeyS');for(let frame=0;frame<300;frame++)t.update(dt);
  out.aimUsesDown=p.angle<oldAngle&&!p.magnetActive&&p.magnetHold===0;
  ({p,b,key}=prepare());b.x=900;b.y=531;t.trackBall(b);
  const best=b.progress,history=b.visited.length;p.x=900;p.y=516;
  // Water still resets the physical ball, but its explored progress survives.
  b.x=30;b.y=625;b.resting=false;t.moveBall(b,dt,0);
  for(let frame=0;frame<125;frame++)t.moveBall(b,dt,0);
  out.waterKeepsTracker=b.progress===best&&b.visited.length>=history&&b.x<150;
  t.keys.add(key);for(let frame=0;frame<125;frame++)t.moveBall(b,dt,0);
  out.recoverAfterWater=p.magnetActive&&b.x>73;
  t.keys.clear();t.releaseMagnet(p);b.x=250;b.y=531;b.vx=b.vy=0;b.resting=true;
  t.trackBall(b);out.backwardBonkKeepsTracker=b.progress===best;
  t.keys.add(key);for(let frame=0;frame<125;frame++)t.moveBall(b,dt,0);
  out.recoverAfterBackwardBonk=p.magnetActive&&b.x>250;
  t.keys.clear();t.releaseMagnet(p);p.x=1190;p.y=516;b.x=250;b.y=531;b.vx=b.vy=0;b.resting=true;
  t.keys.add(key);for(let frame=0;frame<125;frame++)t.moveBall(b,dt,0);
  out.unvisitedForwardRecallRejected=!p.magnetActive&&p.magnetHold===0;
  t.loadLevel(1);out.replayClearsTracker=t.players.every(p=>!p.ball.progress&&p.ball.visited.length===0);
  t.keys.clear();t.newMatch();return out;
 });
 console.log('Magnet:',magnet);for(const [name,passed]of Object.entries(magnet))assert.equal(passed,true,name);
 const floors=await page.evaluate(()=>{
  const t=window.testGame,dt=1/120;let samples=0;
  for(let level=0;level<10;level++) {
   t.loadLevel(level);
   for(const s of t.platforms) {
    if(s.w<40)continue;
    for(const x of [s.x+12,s.x+s.w/2,s.x+s.w-12]) {
     const top=s.y+(s.slope||0)*(x-s.x)/s.w;
     // Skip hidden/internal faces; test all surfaces that can actually support a golfer.
     if(t.platforms.some(other=>other!==s&&x>other.x&&x<other.x+other.w&&top>other.y+(other.slope||0)*(x-other.x)/other.w+1&&top-48<other.y+Math.max(0,other.slope||0)+other.h))continue;
     for(const penetration of [0,1,4]) {
      const p={...t.players[0],x,y:top-24+penetration,vx:0,vy:120,grounded:false,falling:0,tumble:false};
      t.movePlayer(p,dt,0);if(p.y+24>top+.1)throw new Error('Floor overlap '+level+' '+s.purpose+' '+x);
      samples++;
     }
     // Fast falls must land on thin decks, including close to an edge.
     const p={...t.players[0],x,y:top-45,vx:0,vy:1500,grounded:false,falling:0,tumble:false};
     t.movePlayer(p,.05,0);if(p.y+24>top+.1)throw new Error('Fast floor sweep '+level+' '+s.purpose);
     samples++;
    }
   }
  }
  t.loadLevel(0);const p=t.players[0];t.jump(p,0);t.movePlayer(p,dt,0);t.jump(p,0);
  const flipStarted=p.flip===.46;t.movePlayer(p,.15,0);const flipProgress=p.flip>0&&p.flip<.4;
  t.movePlayer(p,.35,0);const flipEnds=p.flip===0;
  t.newMatch();return {samples,flipStarted,flipProgress,flipEnds};
 });
 assert.ok(floors.samples>400);for(const key of ['flipStarted','flipProgress','flipEnds'])assert.equal(floors[key],true,key);
 console.log('Floor sweeps and flip:',floors);
 const traversal=await page.evaluate(()=>{
  const t=window.testGame, dt=1/120, output=[];
  for(let level=0;level<10;level++) {
   t.loadLevel(level);const base={...t.players[0]};const queue=[base],visited=new Set();let reached=false, expanded=0,minFoot=640;
   while(queue.length&&expanded<450&&!reached) {
    const state=queue.shift();expanded++;minFoot=Math.min(minFoot,state.y+24);
    for(const dir of [-1,1]) for(const second of [-1,.12,.28,.45,.65]) {
     const p={...state,ball:{...state.ball}};t.keys.clear();t.keys.add(dir<0?'KeyA':'KeyD');
     t.jump(p,0);
     for(let step=0;step<330;step++) {
      if(second>=0&&step===Math.round(second/dt))t.jump(p,0);
      t.movePlayer(p,dt,0);
      if(p.falling)break;
      if(Math.abs(p.x-t.hole.x)<60&&Math.abs(p.y+24-t.hole.y)<8&&p.grounded){reached=true;break;}
      if(step>6&&p.grounded) {
       const key=Math.round(p.x/30)+':'+Math.round((p.y+24)/15);
       if(!visited.has(key)){visited.add(key);queue.push({...p});}
       break;
      }
     }
     if(reached)break;
    }
   }
   output.push({level:level+1,reached,expanded,minFoot});
  }
  t.keys.clear();t.newMatch();return output;
 });
 console.log('Traversal:',traversal);
 for(const result of traversal)assert.equal(result.reached,true,'Player route level '+result.level);
 const ballRoutes=await page.evaluate(()=>{
  const t=window.testGame,dt=1/120, output=[];
  for(let level=0;level<10;level++) {
   t.loadLevel(level);const queue=[{...t.players[0].ball}],visited=new Set();let reached=false,expanded=0,winningPath=[];
   while(queue.length&&expanded<350&&!reached) {
    const layered=level===0,down=false;
    const priority=b=>{
     if(!layered)return -Math.hypot(b.x-t.hole.x,b.y-t.hole.y);
     const layer=down?(b.y<260?0:b.y<460?1:2):(b.y>470?0:b.y>300?1:2);
     return layer*10000-Math.abs(b.x-(layer===1?70:1210));
    };
    queue.sort((a,b)=>priority(b)-priority(a));
    const state=queue.shift();expanded++;
    for(const dir of [1,-1]) for(const angle of [0,15,30,45,60,75,85]) for(const power of [0,.25,.55,.8,1]) {
     t.reset();const p=t.players[0],b=p.ball;Object.assign(b,state,{trail:[],falling:0,vx:0,vy:0,grounded:true,resting:true,settle:0});
     p.x=b.x-dir*29;p.y=b.y-17;p.facing=dir;p.grounded=true;
     t.hitDown(0);if(!p.set)continue;
     p.angle=angle*Math.PI/180;p.charging=true;p.power=power;t.hitUp(0);
     t.players.forEach(p=>{p.x=-1000;p.y=-1000});
     for(let step=0;step<1200;step++) {
      t.moveBall(b,dt,0);
      if(t.winner===0){reached=true;winningPath=[...(state.route||[]),{x:Math.round(state.x),y:Math.round(state.y),dir,angle,power}];break;}
      if(b.falling)break;
      if(step>25&&b.grounded&&b.resting) {
       const key=Math.round(b.x/20)+':'+Math.round(b.y/15);
       if(!visited.has(key)){visited.add(key);queue.push({...b,route:[...(state.route||[]),{x:Math.round(state.x),y:Math.round(state.y),dir,angle,power}]});}
       break;
      }
     }
     if(reached)break;
    }
   }
   output.push({level:level+1,reached,expanded,path:winningPath});
  }
  t.newMatch();return output;
 });
 console.log('Ball routes:',ballRoutes.map(r=>({level:r.level,reached:r.reached,shots:r.path.length})));
 for(const level of [1]) { const route=ballRoutes.find(r=>r.level===level); assert.ok(route.path.length>=3,'Layered course cannot be bypassed with a straight shot'); assert.ok(route.path.some(shot=>shot.dir===-1),'Middle layer requires a return shot'); }
 for(const result of ballRoutes)assert.equal(result.reached,true,'Ball route level '+result.level);
 const courseCleanup=await page.evaluate(()=>{
  const t=window.testGame;
  const third=t.levels[2],green=third.platforms.find(s=>!s.slope&&third.hole.x>s.x+20&&third.hole.x<s.x+s.w-20&&s.y===third.hole.y);
  const eighth=t.levels[7],ninth=t.levels[8],tenth=t.levels[9];
  const seventh=t.levels[6];
  const endFilled=Array.from({length:260},(_,i)=>1020+i).every(x=>seventh.platforms.some(s=>t.roundedContact(x,635,1,s)));
  const first=t.levels[0],backstop=first.platforms.find(s=>s.purpose.includes('backstop'));
  for(const [level,x,y] of [[5,605,590],[7,765,600],[8,350,530],[8,540,530]]) {
   assertUnusedSpaceFilled(level,x,y);
  }
  function assertUnusedSpaceFilled(level,x,y) {
   if(!t.levels[level].platforms.some(s=>t.roundedContact(x,y,1,s))) throw new Error('Unfilled terrain pocket in hole '+(level+1));
  }
  if(t.levels.some(l=>l.platforms.some(s=>s.floating&&s.h<56)))throw new Error('Floating islands must have a substantial underside');
  return {flatThirdGreen:!!green,noTinyFunnelSteps:!eighth.platforms.some(s=>s.w<100&&s.h===24),noFloatingChamberSteps:!ninth.platforms.some(s=>s.h===24&&!s.slope),connectedFinalApproach:tenth.platforms.some(s=>s.slope===-60&&s.x+s.w===1190)&&tenth.platforms.some(s=>s.x===1190&&s.y===500),noGapUnderSeventhFinish:endFilled,firstBackstopFlush:backstop.y+backstop.h===first.hole.y+56};
 });
 for(const [name,passed]of Object.entries(courseCleanup))assert.equal(passed,true,name);
 // Complete the match through the actual next-level button, rather than loading directly.
 for(let i=0;i<10;i++) {
  await page.evaluate(i=>{const t=window.testGame;t.win(i%2);t.render()},i);
  assert.match(await page.locator('#win-detail').innerText(),/CORAL/);
  if(i===9) assert.equal(await page.locator('#winner').innerText(),'MATCH TIED!');
  await page.click('#again');
  assert.equal(await page.evaluate(()=>window.testGame.levelIndex),i===9?0:i+1);
 }
 for(let i=0;i<10;i++) {
  await page.selectOption('#level-select',String(i));
  await page.evaluate(()=>window.testGame.render());
  await page.screenshot({path:'artifacts/levels/level-'+(i+1)+'.png',fullPage:true});
 }
 await page.evaluate(()=>{const t=window.testGame;t.loadLevel(0);t.jump(t.players[0],0);t.movePlayer(t.players[0],.1,0);t.jump(t.players[0],0);t.movePlayer(t.players[0],.15,0);t.render()});
 await page.screenshot({path:'artifacts/levels/double-jump-flip.png',fullPage:true});
 await page.evaluate(()=>{const t=window.testGame;t.loadLevel(1);const p=t.players[0],b=p.ball;p.x=250;p.y=516;b.x=530;b.y=531;b.resting=true;t.keys.add('KeyS');for(let frame=0;frame<70;frame++)t.update(1/120);t.render()});
 await page.screenshot({path:'artifacts/levels/magnet-ready.png',fullPage:true});
 await page.evaluate(()=>{const t=window.testGame;for(let frame=0;frame<140;frame++)t.update(1/120);t.render()});
 await page.screenshot({path:'artifacts/levels/magnet-pulling.png',fullPage:true});
 await page.evaluate(()=>{window.testGame.keys.clear();window.testGame.update(1/120)});
 await page.keyboard.press('KeyH');assert.equal(await page.locator('#help-panel').isVisible(),true);await page.keyboard.press('KeyH');
 await page.setViewportSize({width:800,height:900});await page.screenshot({path:'artifacts/levels/small.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS: pushing/landing/roof/corner/ramp regressions, ten complete player and ball routes, stable starts and accessible cups, controls, double/wall jumps, both shot flows, bonks, all one-second independent resets, sand catches and reduced power, ball-only tunnel access, scoring/replays, next-level flow, new match, help and ten arena renders.');
} finally {await browser.close();}





