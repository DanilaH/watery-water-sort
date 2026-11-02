package com.danilah.waterywatersort;
import org.junit.Test;
import static org.junit.Assert.*;
public class BannerGeometryTest {
 private BannerGeometry.Mapped map(double x,double y,double w,double h){return BannerGeometry.map(x,y,w,h,390,844,0,0,1170,2532,1170,2532,0,0,0,0);}
 @Test public void portraitMapsCssToActualWebViewPixels(){BannerGeometry.Mapped m=map(16,760,358,60);assertNotNull(m);assertEquals(48,m.x);assertEquals(2280,m.y);assertEquals(1074,m.width);assertEquals(180,m.height);}
 @Test public void rejectsOffscreenOnBothAxes(){assertNull(map(-1,760,358,60));assertNull(map(16,800,358,60));assertNull(map(16,760,390,60));}
 @Test public void rejectsNonFiniteAndEmptyGeometry(){assertNull(map(Double.NaN,0,300,50));assertNull(map(0,0,Double.POSITIVE_INFINITY,50));assertNull(map(0,0,300,0));}
 @Test public void fractionalEdgesRoundInwardAndReserveEnoughHeight(){BannerGeometry.Mapped m=BannerGeometry.map(.2,90.2,99.4,5,100,100,3,7,250,250,300,300,0,0,0,0);assertNotNull(m);assertEquals(4,m.x);assertEquals(233,m.y);int required=m.requiredCss(17);BannerGeometry.Mapped next=BannerGeometry.map(.2,90.2,99.4,required,100,100,3,7,250,250,300,300,0,0,0,0);assertNotNull(next);assertTrue(next.height>=17);}
 @Test public void honorsWebViewOffsetAndRootSafeAreas(){BannerGeometry.Mapped m=BannerGeometry.map(0,250,300,50,300,300,30,40,600,600,680,700,20,30,20,30);assertNotNull(m);assertEquals(30,m.x);assertEquals(540,m.y);assertNull(BannerGeometry.map(0,250,300,50,300,300,10,40,600,600,680,700,20,30,20,30));}
 @Test public void shortLandscapeUsesItsOwnMeasuredHeight(){BannerGeometry.Mapped m=BannerGeometry.map(16,260,536,50,568,320,0,0,1136,640,1136,640,0,0,0,0);assertNotNull(m);assertEquals(1072,m.width);assertEquals(520,m.centeredTop(100));assertEquals(50,m.requiredCss(100));}
 @Test public void rejectsRectOutsideNativeWebViewDespiteCssContainment(){assertNull(BannerGeometry.map(0,70,100,30,100,100,0,0,300,250,300,400,0,0,0,0));}
}
