"""Compile the actual interstitial plugin against deterministic platform/SDK doubles.
No SDK playback or physical-device claim: this exercises production Java control flow.
"""
from pathlib import Path
import tempfile,subprocess,sys,shutil,hashlib
S={
'android/content/SharedPreferences.java':'''package android.content; import java.util.*; public class SharedPreferences { Map<String,Long> data=new HashMap<>(); public long getLong(String k,long d){return data.getOrDefault(k,d);} public Editor edit(){return new Editor();} public class Editor { public Editor putLong(String k,long v){data.put(k,v);return this;} public boolean commit(){return true;} } }''',
'android/content/Context.java':'''package android.content; public class Context { private final SharedPreferences prefs=new SharedPreferences(); public SharedPreferences getSharedPreferences(String n,int m){return prefs;} public android.content.res.Resources getResources(){return new android.content.res.Resources();} }''',
'android/content/res/Resources.java':'''package android.content.res; public class Resources { public android.util.DisplayMetrics getDisplayMetrics(){return new android.util.DisplayMetrics();} }''',
'android/util/DisplayMetrics.java':'''package android.util; public class DisplayMetrics { public float density=1; }''',
'android/app/Activity.java':'''package android.app; public class Activity extends android.content.Context { public void runOnUiThread(Runnable r){r.run();} public <T extends android.view.View>T findViewById(int id){return null;} }''',
'android/R.java':'''package android; public class R { public static class id {public static int content=1;} }''',
'android/os/Looper.java':'''package android.os; public class Looper { public static Looper getMainLooper(){return new Looper();} }''',
'android/os/Handler.java':'''package android.os; public class Handler {public Handler(Looper l){} public void postDelayed(Runnable r,long t){} public void removeCallbacksAndMessages(Object o){} }''',
'android/graphics/Rect.java':'''package android.graphics; public class Rect {}''',
'android/view/Gravity.java':'''package android.view; public class Gravity { public static final int TOP=1,LEFT=2; }''',
'android/view/View.java':'''package android.view; public class View { public static final int VISIBLE=0,INVISIBLE=4; public void setVisibility(int v){} public int getWidth(){return 390;} public int getHeight(){return 844;} public void getLocationOnScreen(int[] a){} public View getRootView(){return this;} public int getPaddingLeft(){return 0;} public int getPaddingTop(){return 0;} public Object getParent(){return null;} }''',
'android/view/ViewGroup.java':'''package android.view; public class ViewGroup extends View {public void removeView(View v){} public void addView(View v){} public void addView(View v,Object p){} }''',
'android/widget/FrameLayout.java':'''package android.widget; public class FrameLayout extends android.view.ViewGroup { public FrameLayout(android.content.Context c){} public void setClipChildren(boolean b){} public void setLayoutParams(LayoutParams p){} public static class LayoutParams {public int gravity,leftMargin,topMargin;public LayoutParams(int w,int h){}} }''',
'androidx/core/view/ViewCompat.java':'''package androidx.core.view; public class ViewCompat {public static WindowInsetsCompat getRootWindowInsets(android.view.View v){return null;} }''',
'androidx/core/view/WindowInsetsCompat.java':'''package androidx.core.view; public class WindowInsetsCompat {public androidx.core.graphics.Insets getInsets(int i){return androidx.core.graphics.Insets.NONE;} public static class Type {public static int systemBars(){return 0;} public static int displayCutout(){return 0;}} }''',
'androidx/core/graphics/Insets.java':'''package androidx.core.graphics; public class Insets {public int left,right,top,bottom;public static final Insets NONE=new Insets();}''',
'com/getcapacitor/JSObject.java':'''package com.getcapacitor; public class JSObject extends java.util.HashMap<String,Object> {public double getDouble(String k){return ((Number)get(k)).doubleValue();}}''',
'com/getcapacitor/PluginCall.java':'''package com.getcapacitor; public class PluginCall {public JSObject result;public int resolutions; public void resolve(){resolutions++;} public void resolve(JSObject r){result=r;resolutions++;} public boolean getBoolean(String k,boolean d){return d;}public JSObject getObject(String k){return null;} }''',
'com/getcapacitor/Bridge.java':'''package com.getcapacitor;public class Bridge {public android.view.View getWebView(){return new android.view.View();}}''',
'com/getcapacitor/Plugin.java':'''package com.getcapacitor;public class Plugin {private android.app.Activity activity=new android.app.Activity();public android.app.Activity getActivity(){return activity;}public android.content.Context getContext(){return activity;}public Bridge getBridge(){return new Bridge();}public void load(){}public void notifyListeners(String s,JSObject o){} protected void handleOnPause(){}protected void handleOnResume(){}protected void handleOnDestroy(){} }''',
'com/yandex/mobile/ads/common/YandexAds.java':'''package com.yandex.mobile.ads.common;public class YandexAds {public static void initialize(android.content.Context c,Runnable r){r.run();}}''',
'com/yandex/mobile/ads/common/AdRequest.java':'''package com.yandex.mobile.ads.common;public class AdRequest {public static class Builder {public Builder(String s){}public AdRequest build(){return new AdRequest();}}}''',
'com/yandex/mobile/ads/interstitial/InterstitialAdEventListener.java':'''package com.yandex.mobile.ads.interstitial;import com.yandex.mobile.ads.common.*;public interface InterstitialAdEventListener {void onAdShown();void onAdFailedToShow(AdError e);void onAdDismissed();void onAdClicked();void onAdImpression(ImpressionData d);}''',
'com/yandex/mobile/ads/interstitial/InterstitialAdLoadListener.java':'''package com.yandex.mobile.ads.interstitial;import com.yandex.mobile.ads.common.*;public interface InterstitialAdLoadListener {void onAdLoaded(InterstitialAd a);void onAdFailedToLoad(AdRequestError e);}''',
'com/yandex/mobile/ads/interstitial/InterstitialAd.java':'''package com.yandex.mobile.ads.interstitial;public class InterstitialAd {public InterstitialAdEventListener listener;public int shows;public void setAdEventListener(InterstitialAdEventListener l){listener=l;}public void show(android.app.Activity a){shows++;}}''',
'com/yandex/mobile/ads/interstitial/InterstitialAdLoader.java':'''package com.yandex.mobile.ads.interstitial;import com.yandex.mobile.ads.common.*;public class InterstitialAdLoader {public static int loads;public static InterstitialAdLoadListener pending;public InterstitialAdLoader(android.app.Activity a){}public void cancelLoading(){} public void loadAd(AdRequest r,InterstitialAdLoadListener l){loads++;pending=l;} }''',
'com/yandex/mobile/ads/banner/BannerAdSize.java':'''package com.yandex.mobile.ads.banner;public class BannerAdSize {public static BannerAdSize sticky(android.content.Context c,int w){return new BannerAdSize();}public int getHeightInPixels(android.content.Context c){return 50;} }''',
'com/yandex/mobile/ads/banner/BannerAdEventListener.java':'''package com.yandex.mobile.ads.banner;import com.yandex.mobile.ads.common.*;public interface BannerAdEventListener {void onAdLoaded();void onAdFailedToLoad(AdRequestError e);void onAdClicked();void onImpression(ImpressionData d);}''',
'com/yandex/mobile/ads/banner/BannerAdView.java':'''package com.yandex.mobile.ads.banner;public class BannerAdView extends android.view.View {public BannerAdView(android.content.Context c){} public void setBannerAdEventListener(BannerAdEventListener l){}public void destroy(){}public void setAdSize(BannerAdSize s){}public void loadAd(com.yandex.mobile.ads.common.AdRequest r){} }''',
'com/danilah/waterywatersort/BuildConfig.java':'''package com.danilah.waterywatersort;public class BuildConfig {public static final boolean DEBUG=true;public static final String INTERSTITIAL_AD_UNIT_ID="demo",BANNER_AD_UNIT_ID="demo";}''',
'com/danilah/waterywatersort/WaterAnalyticsPlugin.java':'''package com.danilah.waterywatersort;public class WaterAnalyticsPlugin {static void ad(String f,String s){} }''',
}
for name in ['NonNull','Nullable']:S[f'androidx/annotation/{name}.java']=f'package androidx.annotation;public @interface {name} {{}}'
S['com/getcapacitor/annotation/CapacitorPlugin.java']='package com.getcapacitor.annotation;public @interface CapacitorPlugin {String name();}'
S['com/getcapacitor/PluginMethod.java']='package com.getcapacitor;public @interface PluginMethod {}'
for name in ['AdError','AdRequestError','ImpressionData']:S[f'com/yandex/mobile/ads/common/{name}.java']=f'package com.yandex.mobile.ads.common;public class {name} {{}}'
S['com/danilah/waterywatersort/NativeAdRace.java']='''package com.danilah.waterywatersort;
import com.getcapacitor.*;import com.yandex.mobile.ads.interstitial.*;import com.yandex.mobile.ads.common.*;
public class NativeAdRace {
 static void check(boolean b,String s){if(!b)throw new AssertionError(s);}
 static class Fixture {
  WaterAdsPlugin plugin=new WaterAdsPlugin();InterstitialAd ad=new InterstitialAd();PluginCall call=new PluginCall();InterstitialAdEventListener events;int loads;
  Fixture()throws Exception {plugin.load();InterstitialAdLoader.pending.onAdLoaded(ad);plugin.show(call);events=ad.listener;java.lang.reflect.Field retry=WaterAdsPlugin.class.getDeclaredField("retryAt");retry.setAccessible(true);// Model a 30+ second ad: initial preload backoff has elapsed.
   retry.setLong(plugin,0);loads=InterstitialAdLoader.loads;check(ad.shows==1&&call.resolutions==0,"show pending");}
  void done(String status){check(call.resolutions==1,"dismiss must resolve original bridge call exactly once");check(status.equals(call.result.get("status")),"wrong result");check(!FullscreenAds.busy(),"fullscreen lock leaked");plugin.handleOnDestroy();}
 }
 public static void main(String[] args)throws Exception {
  int passed=0;
  {Fixture f=new Fixture();f.plugin.handleOnPause();f.plugin.handleOnResume();f.events.onAdDismissed();f.done("shown");passed++;}
  {Fixture f=new Fixture();f.plugin.prepare(new PluginCall());f.events.onAdDismissed();f.done("shown");passed++;}
  {Fixture f=new Fixture();f.plugin.handleOnPause();f.events.onAdDismissed();f.plugin.handleOnResume();f.done("shown");passed++;}
  {Fixture f=new Fixture();for(int i=0;i<30;i++){f.plugin.handleOnPause();f.plugin.handleOnResume();f.plugin.prepare(new PluginCall());}check(InterstitialAdLoader.loads==f.loads,"preloaded over active show");f.events.onAdDismissed();f.done("shown");passed++;}
  {Fixture f=new Fixture();f.plugin.handleOnPause();f.plugin.handleOnResume();f.events.onAdFailedToShow(new AdError());f.done("failed");passed++;}
  {Fixture f=new Fixture();f.events.onAdDismissed();f.events.onAdDismissed();f.done("shown");passed++;}
  {WaterAdsPlugin p=new WaterAdsPlugin();p.load();PluginCall c=new PluginCall();p.show(c);check(c.resolutions==1&&"unavailable".equals(c.result.get("status")),"no-fill must return");p.handleOnDestroy();passed++;}
  {WaterAdsPlugin p=new WaterAdsPlugin();p.load();Object rewarded=new Object();FullscreenAds.acquire(rewarded);int n=InterstitialAdLoader.loads;p.handleOnResume();p.prepare(new PluginCall());check(InterstitialAdLoader.loads==n,"preloaded during rewarded");FullscreenAds.release(rewarded,p.getContext(),false);p.handleOnDestroy();passed++;}
  {Fixture f=new Fixture();f.plugin.handleOnDestroy();f.events.onAdDismissed();f.done("closed");passed++;}
  System.out.println("Actual WaterAdsPlugin: "+passed+" native control-flow scenarios passed");
 }
}'''
BASELINE_SHA256='894b7128a2d0c8f628dd205ec159472ea279364a7b0e34ad745d78af6ea863fb' # released 0.44 / 85c7ce6
baseline='--baseline' in sys.argv
root=Path('android/app/src/main/java/com/danilah/waterywatersort')
with tempfile.TemporaryDirectory() as directory:
 folder=Path(directory)
 for path,content in S.items():
  p=folder/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(content)
 for name in ['WaterAdsPlugin','FullscreenAds','BannerGeometry']:
  source=(Path('tests/native/ads-44/WaterAdsPlugin.java').read_text() if baseline and name=='WaterAdsPlugin' else (root/f'{name}.java').read_text())
  if baseline and name=='WaterAdsPlugin':assert hashlib.sha256(source.encode()).hexdigest()==BASELINE_SHA256
  (folder/f'com/danilah/waterywatersort/{name}.java').write_text(source)
 compiler=['javac'] if shutil.which('javac') else ['java','-m','jdk.compiler/com.sun.tools.javac.Main']
 subprocess.run([*compiler,'-d',str(folder/'classes'),*map(str,folder.rglob('*.java'))],check=True)
 result=subprocess.run(['java','-cp',str(folder/'classes'),'com.danilah.waterywatersort.NativeAdRace'],text=True,capture_output=True)
 if baseline:
  assert result.returncode!=0 and 'dismiss must resolve original bridge call exactly once' in result.stderr, result.stdout+result.stderr
  print('Baseline 0.44 reproduced: resume/preload invalidates dismissal and strands the bridge call')
 else:
  assert result.returncode==0,result.stdout+result.stderr
  print(result.stdout.strip())
