export type Platform = { x: number; y: number; w: number; h: number; r: number; slope?: number; floating?: boolean; sand?: boolean; purpose: string };
export type Hazard = { x: number; y: number; w: number; h: number; kind: 'water' | 'pit' };
export type Level = {
  name: string; idea: string; difficulty: number; start: { x: number; y: number };
  hole: { x: number; y: number; r: number }; platforms: Platform[]; hazards: Hazard[];
  labels: { x: number; y: number; text: string }[];
};
// Banks grow from the ground. Only explicitly marked ledges and decks float.
const land = (x: number, y: number, w: number, purpose: string, sand = false): Platform => ({ x,y,w,h:640-y,r:0,sand,purpose });
const ledge = (x: number, y: number, w: number, purpose: string, sand = false): Platform => ({ x,y,w,h:64,r:5,floating:true,sand,purpose });
const wall = (x: number, y: number, w: number, h: number, purpose: string): Platform => ({ x,y,w,h,r:0,purpose });
const ramp = (x: number, y: number, w: number, slope: number, purpose: string): Platform => ({ x,y,w,h:640-y-Math.max(0,slope),r:0,slope,purpose });
const water = (): Hazard[] => [{ x:0,y:610,w:1280,h:30,kind:'water' }];
const label = (x: number,y: number,text: string) => ({x,y,text});
const goal = (x: number,y: number) => ({x,y,r:16});
// Three continuous fairways with alternating openings. The decks themselves block
// direct shots: up courses lift at right then left; down courses drop at right then left.
function switchback(name: string, down: boolean, variant: 'ravine' | 'dunes' | 'cliff' | 'funnels' | 'tunnel'): Level {
 const first=down?170:550, middle=down?360:390, last=down?550:230;
 const thin=(x:number,y:number,w:number,purpose:string,sand=false):Platform=>({x,y,w,h:56,r:0,floating:true,purpose,sand});
 const slope=(x:number,y:number,w:number,dy:number,purpose:string,base=false):Platform=>({x,y,w,h:base?640-y-Math.max(0,dy):56,floating:!base,r:0,slope:dy,purpose});
 const p:Platform[]=[];
 // The tee-to-turn lane has gentle joined slopes rather than a staircase of boxes.
 p.push(down?thin(0,first,230,'First-layer tee'):land(0,first,230,'First-layer tee'));
 p.push(slope(230,first,200,30,'Rolling fairway down-slope',!down));
 if(variant==='ravine') {
  // A visible stream interrupts only the lower route; the banks remain sloped.
  p.push(slope(480,first+30,240,-30,'Far stream bank rolling toward the turn',!down));
 } else p.push(slope(430,first+30,290,-30,'Rolling fairway rises into the turn',!down));
 p.push(down?thin(720,first,230,'First-layer approach to the drop'):land(720,first,230,'First-layer approach to the lift'));
 p.push(down?thin(950,first,140,'Right-hand drop lip'):land(950,first,190,'Right-hand lift approach'));
 if(!down) p.push(land(1140,first,140,'Sand holds the ball at the right-hand lift',true));
 // Middle layer reverses direction. Its only way onward is at the far left.
 if(down) {
  p.push(thin(190,middle,170,'Left-hand drop lip',true));
  p.push(slope(360,middle,250,25,'Middle-layer roll toward left turn'));
  p.push(slope(610,middle+25,250,-25,'Middle-layer bank'));
  p.push(thin(860,middle,220,'Return fairway'));
  p.push(thin(1080,middle,200,'Catches the first drop',true));
 } else {
  p.push(thin(0,middle,180,'Left-hand lift sand pocket',true));
  p.push(slope(180,middle,250,25,'Return fairway rolling slope'));
  p.push(slope(430,middle+25,290,-25,'Return fairway approach to left lift'));
  p.push(thin(720,middle,230,'Middle return fairway'));
  p.push(thin(950,middle,140,'Catches the right-hand lift',true));
 }
 // Final layer travels right again; the shallow final hill requires a finishing chip.
 if(down) {
  p.push(land(0,last,190,'Catches the left-hand drop',true));
  p.push(ramp(190,last,230,25,'Final fairway rolling down into bowl'));
  p.push(ramp(420,last+25,260,-25,'Final fairway climbs out of bowl'));
  p.push(land(680,last,270,'Final approach'));
  p.push(ramp(950,last,180,-40,'Final putting hill'));
  p.push(land(1130,last-40,150,'Goal green'));
 } else {
  p.push(thin(190,last,150,'Catches the left-hand lift',true));
  p.push(slope(340,last,240,20,'Final-layer downhill roll'));
  p.push(slope(580,last+20,220,-20,'Final-layer shallow uphill roll'));
  p.push(thin(800,last,150,'Final-layer approach'));
  p.push(slope(950,last,180,-40,'Final putting hill'));
  p.push(thin(1130,last-40,150,'Goal green'));
 }
 p.push(wall(1264,last-115,16,131,'Final green backstop ends flush with the deck underside'));
 if(variant==='tunnel') {
  const roof=middle-55;
  p.push(wall(585,roof,145,18,'Ball-only passage roof; golfers jump over it'));
 }
 if(variant==='funnels') {
  p.push(thin(1160,first+90,120,'Player descent step beside first drop'));
  p.push(thin(0,middle+95,125,'Player descent step beside second drop'));
 }
 return {name,idea:down?'RIGHT → DROP → LEFT → DROP → RIGHT: three descending fairways.':'RIGHT → LIFT → LEFT → LIFT → RIGHT: three stacked fairways.',
  difficulty:variant==='ravine'?4:variant==='tunnel'?7:5,start:{x:45,y:first},hole:goal(1210,last-40),platforms:p,hazards:water(),
  labels:[label(345,first-26,'1 >>> RIGHT'),label(down?1110:1140,first-40,down?'DROP HERE':'LIFT HERE'),
   label(745,middle-24,'2 <<< LEFT'),label(down?195:35,middle-27,down?'DROP LEFT':'LIFT LEFT'),label(815,last-24,'3 >>> FINAL HILL')]};
}
export const levels: Level[] = [
 switchback('Mind the Golf Gap',false,'ravine'),
 {
  name:'Mouse Hole Mountain',idea:'A low tunnel takes balls through the hill; golfers climb its sides.',difficulty:4,
  start:{x:45,y:540},hole:goal(1200,540),hazards:water(),
  platforms:[
   land(0,540,830,'Continuous tee and tunnel floor'),
   wall(330,260,500,243,'Mountain body; 37px ball passage below'),
   ledge(220,420,110,'First foothold with clear headroom above the tunnel approach'),
   ledge(160,300,100,'Offset second foothold leaves a wide jump approach beside the first step'),
   ledge(830,350,100,'Descent from mountain roof'),
   land(830,540,140,'Tunnel exit sand catch',true),
   ramp(970,540,90,-65,'Final green approach hill'),
   ramp(1060,475,100,65,'Downhill putt toward cup'),
   land(1160,540,120,'Goal green'),
  ],labels:[label(365,522,'BALL ONLY >>>'),label(470,235,'OVER THE HILL'),label(840,514,'CATCH')],
 },
 {
  name:'The Accidental Avalanche',idea:'A downhill run climbs a ridge, plunges into a bowl, then climbs to the cup.',difficulty:5,
  start:{x:45,y:190},hole:goal(1205,460),hazards:water(),
  platforms:[land(0,190,200,'High tee'),ramp(200,190,200,180,'First avalanche descent'),
   land(400,370,150,'Valley sand brake',true),ramp(550,370,150,-130,'Momentum climb onto ridge'),
   land(700,240,130,'Ridge shot setup',true),ramp(830,240,200,300,'Steep plunge toward lower bowl'),
   land(1030,540,80,'Second sand catch',true),ramp(1110,540,60,-80,'Final climb from bowl'),
   land(1170,460,110,'Broad flat goal green'),wall(1264,390,16,70,'Goal backstop')],
  labels:[label(255,170,'DOWN'),label(565,345,'UP THE RIDGE'),label(865,220,'PLUNGE'),label(1135,510,'FINAL CLIMB')],
 },
 {
  name:'Stairway to Fore',idea:'Climb broad, offset shelves through open right-side gaps, then finish left on the upper fairway.',difficulty:6,
  start:{x:45,y:550},hole:goal(240,230),hazards:water(),
  platforms:[land(0,550,580,'Tee fairway beneath tower approach'),ramp(580,550,160,-50,'Uphill entry into tower'),
   land(740,500,400,'Broad tower entry sand catch',true),wall(1140,80,28,420,'Tower spine shifted right for generous lift passages'),
   ledge(620,360,300,'Middle climbing shelf with 80px clear passage beside upper shelf',true),
   ledge(1000,220,140,'Upper sand shelf offset right of both adjacent fairways',true),
   ledge(500,80,420,'Upper fairway launching left; 220px open lift space beside spine'),
   {x:360,y:230,w:140,h:64,r:0,slope:-150,floating:true,purpose:'Upper fairway descends toward the final hill'},
   ledge(80,230,280,'Left upper green and goal catch'),
   wall(80,165,15,65,'Final green bank target')],
  labels:[label(625,510,'ENTER RIGHT'),label(940,475,'OPEN CLIMB'),label(650,335,'UP / BANK'),label(535,55,'FINISH LEFT <<<')],
 },
 {
  name:'Island Hopping Handicap',idea:'Connected island banks and low stepping stones cross a continuous lake.',difficulty:5,
  start:{x:40,y:490},hole:goal(1200,450),hazards:water(),
  platforms:[
   land(0,490,230,'Beach tee'),
   land(290,450,150,'First island catch',true),
   land(500,345,190,'High island for long-distance shots',true),
   land(810,480,170,'Low island catch',true),
   land(1100,450,180,'Final island green'),
   ramp(230,490,60,-40,'Smooth connected bank to first island'),
   ramp(440,450,60,-105,'Smooth climb from first catch to high island'),
   land(715,440,70,'Step between high and low islands'),
   land(1005,530,70,'Final water crossing step'),
  ],labels:[label(510,320,'SKIP AN ISLAND?'),label(816,455,'LOW CATCH'),label(1010,500,'LAST STEP')],
 },
 {
  name:'Around the Rim',idea:'Loop around a broad basin; its sand floor catches the ball before the center putting green.',difficulty:6,
  start:{x:45,y:240},hole:goal(735,560),hazards:water(),
  platforms:[
   land(0,240,230,'Left rim tee'),
   ramp(230,240,160,120,'Descend from rim into basin'),
   land(390,360,110,'First sand pocket',true),
   ramp(500,360,110,200,'Inner bowl slope'),
   land(610,560,80,'Broad flat sand catch at the bottom of the bowl',true),
   land(690,560,90,'Flat center putting green'),
   ramp(780,560,170,-140,'Right bowl slope'),
   land(950,420,120,'Right rim sand pocket',true),
   ramp(1070,420,130,-180,'Outer rim wall for banks'),
   land(1200,240,80,'Far rim bank target'),
   ledge(365,220,190,'Outer rim player route and safer staged shot'),
   ledge(685,250,180,'Rim crossing before looping inward'),
   ledge(950,300,130,'Descent with clear golfer headroom above the right pocket'),
  ],labels:[label(375,195,'RIM ROUTE'),label(610,530,'BOWL / PUTT'),label(953,395,'LOOP BACK')],
 },
 {
  name:'Bunker Bargain',idea:'Cross connected sand valleys or take the airborne grass shortcut, then climb to the raised green.',difficulty:6,
  start:{x:40,y:440},hole:goal(1220,350),hazards:water(),
  platforms:[
   land(0,440,225,'Grass tee'),
   ramp(225,440,100,100,'First bunker entrance'),
   land(325,540,150,'First sand bunker',true),
   ramp(475,540,100,-80,'First bunker exit'),
   land(575,460,65,'Grass ridge for full-power shots'),
   ramp(640,460,80,80,'Second bunker entrance'),
   land(720,540,150,'Second bunker',true),
   ramp(870,540,90,-80,'Second bunker exit'),
   land(960,460,60,'Last grass ridge'),
   ramp(1020,460,150,-110,'Continuous grassy climb into the raised green'),
   land(1170,350,110,'Raised flat putting green'),
   ledge(275,330,150,'Shortcut landing above first bunker'),
   ledge(540,300,170,'Shortcut launch above second bunker'),
   ledge(840,325,180,'Shortcut landing and shot toward cup'),
  ],labels:[label(540,275,'FAST GRASS'),label(335,515,'SAND CATCH'),label(730,515,'SAND CATCH'),label(1050,365,'UP TO THE GREEN')],
 },
 {
  name:'Drop It Like a Putt',idea:'Two diagonal funnel drops lead to a leftward shot onto the final island hill.',difficulty:6,
  start:{x:45,y:170},hole:goal(490,520),hazards:water(),
  platforms:[ledge(0,170,250,'Overlook tee'),
   {x:250,y:170,w:120,h:64,r:0,slope:130,floating:true,purpose:'Connected descent from tee into first funnel'},
   ledge(370,300,140,'First funnel sand catcher',true),
   {x:510,y:300,w:100,h:64,r:0,slope:-100,floating:true,purpose:'First funnel launch lip'},
   ramp(540,520,100,-150,'Solid connecting bank from final green to second funnel'),
   land(640,370,30,'Rounded-off approach crest above second funnel'),
   ramp(670,370,70,100,'Grounded second funnel entry bank'),
   land(740,470,150,'Grounded second funnel sand catcher',true),
   ramp(890,470,100,-100,'Grounded second funnel launch bank'),
   land(300,560,100,'Low final island catch',true),ramp(400,560,60,-40,'Final island hill'),
   land(460,520,80,'Flat final green joined directly to the second funnel bank')],
  labels:[label(370,275,'FIRST FUNNEL'),label(747,445,'SECOND FUNNEL'),label(770,530,'RETURN LEFT <<<'),label(380,590,'ISLAND HILL')],
 },
 {
  name:'Bank Statement',idea:'A solid central hill, a sand catch, and an enclosed final valley reward ricochet shots.',difficulty:6,
  start:{x:45,y:560},hole:goal(1200,340),hazards:water(),
  platforms:[
   land(0,560,450,'First chamber floor'),
   land(450,560,330,'Second chamber sand floor',true),
   land(780,560,220,'Final bank-shot setup floor'),
   wall(0,115,18,445,'Left ricochet wall'),
   wall(1264,115,16,445,'Right ricochet wall'),
   ramp(180,560,80,-115,'Smooth approach from chamber floor onto the central hill'),
   ramp(260,445,160,-165,'Solid central hill ascent fills unused triangular space'),
   land(420,280,80,'Broad hilltop sand catch',true),
   ramp(500,280,130,160,'Solid descent into the second chamber'),
   land(630,440,100,'Sand bank obstacle catches shots from the divider',true),
   ramp(730,440,110,120,'Connected descent from sand bank into final shot setup'),
   ramp(1000,560,150,-220,'Final ricochet and player ascent'),
   land(1150,340,130,'Raised goal green'),
  ],labels:[label(80,415,'BANK UP'),label(440,255,'CREST / CATCH'),label(930,300,'BANK OR CLIMB')],
 },
 {
  name:'Crossing the Streams',idea:'Drop into a valley, climb to a ball tunnel, then descend behind the canyon wall.',difficulty:7,
  start:{x:45,y:480},hole:goal(1210,500),hazards:water(),
  platforms:[land(0,480,300,'Shared canyon tee'),ramp(300,480,200,80,'Valley entry'),
   land(500,560,100,'Valley sand catch',true),ramp(600,560,150,-240,'Broader connected climb from valley to tunnel'),
   land(750,320,180,'Grounded tunnel launch terrace',true),
   wall(930,100,50,183,'Upper canyon wall; leaves ball slot below'),wall(930,320,50,320,'Lower canyon wall and tunnel floor'),
   ledge(850,200,80,'Player climb attached to canyon wall above ball tunnel'),
   ramp(980,320,100,240,'Connected descent from tunnel exit into final bowl'),
   land(1080,560,50,'Exit bowl sand brake',true),ramp(1130,560,60,-60,'Broad final hill approach'),
   land(1190,500,90,'Flat final green'),wall(1264,425,16,75,'Final green backstop')],
  labels:[label(350,455,'DOWN TO VALLEY'),label(662,435,'UP TO TUNNEL'),label(772,295,'BALL ONLY >>>'),label(1005,235,'PLAYER DESCENT')],
 },
];
