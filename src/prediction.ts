export type MoveCommand = { tick:number; left:boolean; right:boolean; jump:boolean };
export const MOVEMENT_STEP = 1 / 120;

// Only the assigned player's movement is predicted. Ball/world outcomes stay on the host.
export class MovementPrediction<P> {
  pose: P | undefined;
  private history: MoveCommand[] = [];
  private outgoing: MoveCommand[] = [];
  private tick = 0;
  private ack = 0;
  constructor(private copy:(p:P)=>P, private step:(p:P, command:MoveCommand)=>void) {}
  clear() { this.pose=undefined;this.history=[];this.outgoing=[];this.tick=0;this.ack=0; }
  advance(input:Omit<MoveCommand,'tick'>) {
    // Bound memory and speculation during disconnects. Resume on acknowledgement.
    if(!this.pose || this.history.length>=120)return;
    const command={...input,tick:++this.tick};
    this.history.push(command);this.outgoing.push(command);this.step(this.pose,command);
  }
  reconcile(authoritative:P, ack:number) {
    if(ack<this.ack)return;
    this.ack=ack;this.tick=Math.max(this.tick,ack);
    this.history=this.history.filter(c=>c.tick>ack);
    this.pose=this.copy(authoritative);
    for(const command of this.history)this.step(this.pose,command);
  }
  drain() { const frames=this.outgoing;this.outgoing=[];return frames; }
}

// A bounded queue preserves jump taps and input ordering across jittery packet delivery.
export class MovementQueue {
  private frames:MoveCommand[]=[];
  private received=0;
  private credit=0;
  acknowledged=0;
  clear(){this.frames=[];this.received=0;this.credit=0;this.acknowledged=0;}
  push(frames:MoveCommand[]) {
    for(const frame of frames) {
      if(frame.tick<=this.received)continue;
      if(frame.tick!==this.received+1 || this.frames.length>=120)return;
      this.frames.push(frame);this.received=frame.tick;
    }
  }
  advance(dt:number, step:(command:MoveCommand)=>void, idle?:()=>void) {
    // Reuse elapsed host time after a short packet stall, never arbitrary client dt.
    this.credit+=dt;
    if(this.credit>.25) {
      // A background client must not leave a golfer suspended in midair.
      idle?.();this.credit=.25;
    }
    let count=0;
    while(this.frames.length && this.credit+1e-9>=MOVEMENT_STEP && count++<8) {
      const command=this.frames.shift()!;
      step(command);this.acknowledged=command.tick;this.credit-=MOVEMENT_STEP;
    }
  }
}
