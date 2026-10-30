import Phaser from 'phaser';

/** Generated transparent glass, fitted vertically without stretching its rim or round foot. */
export class GlassMaterial {
  readonly enabled:boolean;
  private tubes=new Map<number,Phaser.GameObjects.NineSlice>();
  private corks=new Map<number,Phaser.GameObjects.Image>();
  private orderingDirty=false;
  constructor(private scene:Phaser.Scene,private root:Phaser.GameObjects.Container){this.enabled=scene.game.renderer.type===Phaser.WEBGL;}
  beginFrame(){for(const s of [...this.tubes.values(),...this.corks.values()])s.setVisible(false);}
  restore(index:number,cork:boolean){this.tubes.get(index)?.setVisible(true);this.corks.get(index)?.setVisible(cork);}
  corkVisible(index:number){return this.corks.get(index)?.visible??false;}
  vessel(index:number,pose:{x:number;y:number;width:number;height:number;angle:number;stretch:number;flying:boolean}){
    if(!this.enabled)return;
    const scale=pose.width/204,height=pose.height/scale+66,depth=pose.flying?2:1;
    let tube=this.tubes.get(index);
    if(!tube){tube=this.scene.add.nineslice(0,0,'tube-glass-27',undefined,276,height,1,1,80,170);this.root.add(tube);this.tubes.set(index,tube);this.orderingDirty=true;}
    if(Math.abs(tube.height-height)>.001)tube.setSlices(276,height,1,1,80,170);
    if(tube.depth!==depth){tube.setDepth(depth);this.orderingDirty=true;}
    tube.setOrigin(.5,27/height).setPosition(pose.x,pose.y).setScale(scale*pose.stretch,scale/pose.stretch).setRotation(pose.angle).setVisible(true);
  }
  cork(index:number,x:number,y:number,width:number,height:number,opacity:number){
    if(!this.enabled)return;
    let cork=this.corks.get(index);
    if(!cork){cork=this.scene.add.image(0,0,'tube-cork-27').setOrigin(.5,0).setDepth(1.1);this.root.add(cork);this.corks.set(index,cork);this.orderingDirty=true;}
    cork.setPosition(x,y).setDisplaySize(width,height).setAlpha(opacity).setVisible(opacity>.001);
  }
  finishFrame(){if(this.orderingDirty){this.root.sort('depth');this.orderingDirty=false;}}
  reset(){this.beginFrame();}
}
