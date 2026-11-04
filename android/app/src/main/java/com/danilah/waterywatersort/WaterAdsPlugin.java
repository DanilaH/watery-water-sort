package com.danilah.waterywatersort;

import android.view.View;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.os.Handler;
import android.os.Looper;
import android.graphics.Rect;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.graphics.Insets;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.yandex.mobile.ads.common.*;
import com.yandex.mobile.ads.interstitial.*;
import com.yandex.mobile.ads.banner.*;

@CapacitorPlugin(name="WaterAds")
public class WaterAdsPlugin extends Plugin {
 private InterstitialAdLoader loader;private InterstitialAd ad,displayed;private PluginCall active;
 private boolean loading=false,destroyed=false,foreground=true,shown=false,wanted=false,sdkReady=false,geometryValid=false;
 private long retryAt=0,loadedAt=0,bannerFailedAt=0;private int generation=0,bannerGeneration=0,bannerWidth=0;
 private BannerAdView banner;private FrameLayout container;private Runnable visibility;
 private final Handler handler=new Handler(Looper.getMainLooper());
 @Override public void load(){visibility=()->{if(container!=null)container.setVisibility(wanted&&geometryValid&&foreground&&!FullscreenAds.busy()?View.VISIBLE:View.INVISIBLE);};FullscreenAds.visibility=visibility;try{YandexAds.initialize(getContext(),()->getActivity().runOnUiThread(()->{if(destroyed)return;sdkReady=true;notifyListeners("ready",new JSObject());preload();}));}catch(Exception ignored){}}
 private void preload(){
  // Resume/prepare may arrive before the displayed ad dismisses. A load must
  // never invalidate the generation of its still-pending show callback.
  if(!sdkReady||destroyed||!foreground||active!=null||displayed!=null||FullscreenAds.busy()||loading||ad!=null||System.currentTimeMillis()<retryAt||BuildConfig.INTERSTITIAL_AD_UNIT_ID.isEmpty())return;
  loading=true;final int g=++generation;retryAt=System.currentTimeMillis()+30000;
  handler.postDelayed(()->{if(g==generation&&loading){generation++;loading=false;if(loader!=null)loader.cancelLoading();}},15000);
  try{YandexAds.initialize(getContext(),()->getActivity().runOnUiThread(()->{
   if(destroyed||g!=generation||!loading)return;
   try{if(loader==null)loader=new InterstitialAdLoader(getActivity());WaterAnalyticsPlugin.ad("interstitial","request");loader.loadAd(new AdRequest.Builder(BuildConfig.INTERSTITIAL_AD_UNIT_ID).build(),new InterstitialAdLoadListener(){
    @Override public void onAdLoaded(@NonNull InterstitialAd loaded){if(destroyed||g!=generation||!loading){loaded.setAdEventListener(null);return;}loading=false;WaterAnalyticsPlugin.ad("interstitial","loaded");ad=loaded;loadedAt=System.currentTimeMillis();}
    @Override public void onAdFailedToLoad(@NonNull AdRequestError error){if(g==generation){loading=false;WaterAnalyticsPlugin.ad("interstitial","load_error");retryAt=System.currentTimeMillis()+30000;}}
   });}catch(Exception e){if(g==generation)loading=false;}
  }));}catch(Exception e){loading=false;}
 }
 @PluginMethod public void prepare(PluginCall call){getActivity().runOnUiThread(()->{preload();call.resolve();});}
 @PluginMethod public void show(PluginCall call){getActivity().runOnUiThread(()->{
  long now=System.currentTimeMillis();if(ad!=null&&(now<loadedAt||now-loadedAt>1800000)){ad.setAdEventListener(null);ad=null;}
  long attempted=getContext().getSharedPreferences("water-ads",0).getLong("attempt",0);
  if(attempted>now){getContext().getSharedPreferences("water-ads",0).edit().putLong("attempt",now).commit();attempted=now;}
  if(destroyed||!foreground||active!=null||FullscreenAds.busy()||!FullscreenAds.cooled(getContext())||now-attempted<60000){result(call,"unavailable");return;}
  if(!getContext().getSharedPreferences("water-ads",0).edit().putLong("attempt",now).commit()){result(call,"unavailable");return;}
  if(ad==null){preload();result(call,"unavailable");return;}
  if(!FullscreenAds.acquire(this)){result(call,"unavailable");return;}
  active=call;final InterstitialAd current=ad;displayed=current;ad=null;final int g=++generation;shown=false;
  current.setAdEventListener(new InterstitialAdEventListener(){
   @Override public void onAdShown(){if(g==generation){shown=true;WaterAnalyticsPlugin.ad("interstitial","shown");}}
   @Override public void onAdFailedToShow(@NonNull AdError error){if(g==generation){WaterAnalyticsPlugin.ad("interstitial","show_error");finish(current,"failed");}}
   @Override public void onAdDismissed(){if(g==generation){WaterAnalyticsPlugin.ad("interstitial","dismissed");finish(current,"shown");}}
   @Override public void onAdClicked(){}
   @Override public void onAdImpression(@Nullable ImpressionData data){if(g==generation)WaterAnalyticsPlugin.ad("interstitial","impression");}
  });
  // From show() onward Android may pause our Activity; never resume gameplay behind the SDK.
  shown=true;try{current.show(getActivity());}catch(Exception e){finish(current,"failed");}
 });}
 private void result(PluginCall c,String status){JSObject r=new JSObject();r.put("status",status);c.resolve(r);}
 private void finish(InterstitialAd current,String status){current.setAdEventListener(null);displayed=null;generation++;PluginCall c=active;active=null;FullscreenAds.release(this,getContext(),shown);shown=false;if(c!=null)result(c,status);preload();}
 private void destroyBanner(){bannerGeneration++;if(banner!=null){banner.setBannerAdEventListener(null);banner.destroy();banner=null;}if(container!=null){ViewGroup p=(ViewGroup)container.getParent();if(p!=null)p.removeView(container);container=null;}bannerWidth=0;}
 private String bannerPlacement="no visible request",bannerSdk="not requested",bannerGeometry="";
 private int bannerRequests=0,bannerImpressions=0;
 @PluginMethod public void bannerDiagnostics(PluginCall call){getActivity().runOnUiThread(()->{
  JSObject reply=new JSObject();if(BuildConfig.DEBUG){
   reply.put("text","Слот: "+bannerPlacement+"\nSDK: "+bannerSdk+"\nЗапросов: "+bannerRequests+" · показов: "+bannerImpressions+"\n"+bannerGeometry);
  }call.resolve(reply);
 });}
 @PluginMethod public void banner(PluginCall call){getActivity().runOnUiThread(()->{
  wanted=call.getBoolean("visible",false);if(wanted)bannerPlacement="received";if(destroyed||!foreground||FullscreenAds.busy()){geometryValid=false;if(container!=null)container.setVisibility(View.INVISIBLE);call.resolve();return;}
  if(!wanted&&container!=null){geometryValid=false;container.setVisibility(View.INVISIBLE);}
  if(!sdkReady){if(wanted)bannerPlacement="waiting for SDK";call.resolve();return;}
  try{
   JSObject slot=call.getObject("slot"),viewport=call.getObject("viewport");View web=getBridge().getWebView();FrameLayout root=getActivity().findViewById(android.R.id.content);
   if(slot==null||viewport==null||root==null){if(wanted)bannerPlacement="missing bounds";call.resolve();return;}
   double vw=viewport.getDouble("width"),vh=viewport.getDouble("height"),x=slot.getDouble("x"),y=slot.getDouble("y"),w=slot.getDouble("width"),h=slot.getDouble("height");
   int[] wp=new int[2],rp=new int[2];web.getLocationOnScreen(wp);root.getLocationOnScreen(rp);
   WindowInsetsCompat insets=ViewCompat.getRootWindowInsets(root);Insets safe=insets==null?Insets.NONE:insets.getInsets(WindowInsetsCompat.Type.systemBars()|WindowInsetsCompat.Type.displayCutout());
   int safeL=Math.max(0,safe.left-rp[0]),safeT=Math.max(0,safe.top-rp[1]),safeR=Math.max(0,root.getWidth()-(root.getRootView().getWidth()-safe.right-rp[0])),safeB=Math.max(0,root.getHeight()-(root.getRootView().getHeight()-safe.bottom-rp[1]));
   // The WebView can extend behind system bars even when CSS reports zero safe-area insets.
   // Send the overlap before rejecting a slot so the web layout can reserve a safe row.
   JSObject reply=new JSObject();
   double scale=web.getWidth()/vw;
   if(Double.isFinite(scale)&&scale>0){
    int webLeft=wp[0]-rp[0],webTop=wp[1]-rp[1];
    reply.put("safeLeftCss",Math.ceil(Math.max(0,safeL-webLeft)/scale));
    reply.put("safeRightCss",Math.ceil(Math.max(0,webLeft+web.getWidth()-root.getWidth()+safeR)/scale));
    reply.put("safeBottomCss",BannerGeometry.requiredBottomInsetCss(vh,scale,webTop,web.getHeight(),root.getHeight(),safeB));
   }
   if(wanted)bannerGeometry=String.format(java.util.Locale.ROOT,"CSS %.1f,%.1f %.1fx%.1f / %.1fx%.1f; WebView %dx%d; root %dx%d; safe %d,%d,%d,%d",x,y,w,h,vw,vh,web.getWidth(),web.getHeight(),root.getWidth(),root.getHeight(),safeL,safeT,safeR,safeB);
   BannerGeometry.Mapped mapped=BannerGeometry.map(x,y,w,h,vw,vh,wp[0]-rp[0],wp[1]-rp[1],web.getWidth(),web.getHeight(),root.getWidth(),root.getHeight(),safeL,safeT,safeR,safeB);
   if(mapped==null){if(wanted)bannerPlacement="outside safe bounds";geometryValid=false;if(container!=null)container.setVisibility(View.INVISIBLE);reply.put("status","unsafe");call.resolve(reply);return;}
   final int width=mapped.width;float density=getContext().getResources().getDisplayMetrics().density;int dp=(int)Math.floor(width/density);if(dp<1){call.resolve();return;}
   BannerAdSize size=BannerAdSize.sticky(getContext(),dp);int height=size.getHeightInPixels(getContext());
   reply.put("heightCss",mapped.requiredCss(height));
   if(!wanted){call.resolve(reply);return;}
   if(mapped.height<height){bannerPlacement="reserving "+height+"px (have "+mapped.height+"px)";if(container!=null)container.setVisibility(View.INVISIBLE);reply.put("status","reserve");call.resolve(reply);return;}
   int offset=mapped.centeredTop(height);
   boolean needsLoad=banner==null||bannerWidth!=width||bannerFailedAt>0&&System.currentTimeMillis()-bannerFailedAt>=30000;
   if(needsLoad){destroyBanner();bannerFailedAt=0;bannerWidth=width;container=new FrameLayout(getActivity());container.setClipChildren(true);root.addView(container);banner=new BannerAdView(getActivity());container.addView(banner,new FrameLayout.LayoutParams(width,height));banner.setAdSize(size);final int g=++bannerGeneration;
    banner.setBannerAdEventListener(new BannerAdEventListener(){
     @Override public void onAdLoaded(){if(destroyed||g!=bannerGeneration)return;bannerSdk="loaded";visibility.run();WaterAnalyticsPlugin.ad("banner","loaded");}
     @Override public void onAdFailedToLoad(@NonNull AdRequestError error){if(g==bannerGeneration){bannerSdk="load error: "+error;bannerFailedAt=System.currentTimeMillis();WaterAnalyticsPlugin.ad("banner","load_error");handler.postDelayed(()->{if(!destroyed&&g==bannerGeneration)notifyListeners("ready",new JSObject());},30100);}}
     @Override public void onAdClicked(){}
     public void onLeftApplication(){}
     public void onReturnedToApplication(){}
     @Override public void onImpression(@Nullable ImpressionData data){if(g==bannerGeneration){bannerImpressions++;WaterAnalyticsPlugin.ad("banner","impression");}}
    });
   }
   FrameLayout.LayoutParams params=new FrameLayout.LayoutParams(width,height);params.gravity=Gravity.TOP|Gravity.LEFT;params.leftMargin=mapped.x-root.getPaddingLeft();params.topMargin=offset-root.getPaddingTop();container.setLayoutParams(params);geometryValid=true;visibility.run();bannerPlacement="placed "+width+"x"+height+"px";
   if(needsLoad){bannerRequests++;bannerSdk="loading";WaterAnalyticsPlugin.ad("banner","request");banner.loadAd(new AdRequest.Builder(BuildConfig.BANNER_AD_UNIT_ID).build());}
   reply.put("status","placed");call.resolve(reply);
  }catch(Exception e){if(wanted)bannerPlacement="exception: "+e.getClass().getSimpleName()+" "+e.getMessage();if(container!=null)container.setVisibility(View.INVISIBLE);call.resolve();}
 });}
 @Override protected void handleOnPause(){foreground=false;geometryValid=false;if(container!=null)container.setVisibility(View.INVISIBLE);}
 @Override protected void handleOnResume(){foreground=true;preload();/* DOM must remeasure before a banner becomes visible. */}
 @Override protected void handleOnDestroy(){destroyed=true;generation++;loading=false;handler.removeCallbacksAndMessages(null);if(loader!=null)loader.cancelLoading();loader=null;if(ad!=null){ad.setAdEventListener(null);ad=null;}if(displayed!=null){displayed.setAdEventListener(null);displayed=null;}if(active!=null){PluginCall c=active;active=null;FullscreenAds.release(this,getContext(),shown);result(c,"closed");}destroyBanner();if(FullscreenAds.visibility==visibility)FullscreenAds.visibility=null;}
}
