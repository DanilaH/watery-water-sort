package com.danilah.waterywatersort;
/** Android port of mini-games-kit native-banner-placement, 5450f9d. All outputs are root pixels. */
final class BannerGeometry {
 static final class Mapped {
  final int x,y,width,height;final double scale,webY,slotY;
  Mapped(int x,int y,int w,int h,double scale,double webY,double slotY){this.x=x;this.y=y;width=w;height=h;this.scale=scale;this.webY=webY;this.slotY=slotY;}
  int requiredCss(int sdkHeight){return (int)Math.ceil((y+sdkHeight-webY)/scale-slotY);}
  int centeredTop(int sdkHeight){return y+(height-sdkHeight)/2;}
 }
 static Mapped map(double x,double y,double w,double h,double vw,double vh,int wx,int wy,int ww,int wh,int rw,int rh,int sl,int st,int sr,int sb){
  for(double n:new double[]{x,y,w,h,vw,vh})if(!Double.isFinite(n))return null;
  if(x<0||y<0||w<=0||h<=0||vw<=0||vh<=0||ww<=0||wh<=0||rw<=0||rh<=0||x+w>vw||y+h>vh||sl<0||st<0||sr<0||sb<0)return null;
  double scale=ww/vw;int left=(int)Math.ceil(wx+x*scale),top=(int)Math.ceil(wy+y*scale),right=(int)Math.floor(wx+(x+w)*scale),bottom=(int)Math.floor(wy+(y+h)*scale);
  if(right<=left||bottom<=top||left<sl||top<st||right>rw-sr||bottom>rh-sb||left<wx||top<wy||right>wx+ww||bottom>wy+wh)return null;
  return new Mapped(left,top,right-left,bottom-top,scale,wy,y);
 }
}
