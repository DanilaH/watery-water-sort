package com.danilah.waterywatersort;

import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.yandex.mobile.ads.common.*;
import com.yandex.mobile.ads.rewarded.*;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.UUID;

/** Award receipt is durable before JS sees success; acknowledgement follows the game save. */
@CapacitorPlugin(name="WaterRewarded")
public class WaterRewardedPlugin extends Plugin {
 private final Handler handler=new Handler(Looper.getMainLooper());
 private RewardedAdLoader loader;private RewardedAd ad;private PluginCall active;
 private boolean shown=false;private int generation=0;private JSObject receipt;
 private SharedPreferences prefs(){return getContext().getSharedPreferences("water-reward-receipts",0);}
 private JSONArray receipts(){try{return new JSONArray(prefs().getString("pending","[]"));}catch(Exception e){return new JSONArray();}}
 @PluginMethod public void pending(PluginCall call){getActivity().runOnUiThread(()->{JSObject r=new JSObject();r.put("receipts",receipts());call.resolve(r);});}
 @PluginMethod public void ack(PluginCall call){getActivity().runOnUiThread(()->{String token=call.getString("token","");JSONArray next=new JSONArray(),old=receipts();for(int i=0;i<old.length();i++){JSONObject r=old.optJSONObject(i);if(r!=null&&!token.equals(r.optString("token")))next.put(r);}if(!prefs().edit().putString("pending",next.toString()).commit()){call.reject("Receipt acknowledgement failed");return;}call.resolve();});}
 @PluginMethod public void cancel(PluginCall call){getActivity().runOnUiThread(()->{if(active!=null&&!shown)finish("closed");call.resolve();});}
 @PluginMethod public void request(PluginCall call){getActivity().runOnUiThread(()->{
  String level=call.getString("level","");if(!level.matches("water-\\d{3}@\\d+")||active!=null||BuildConfig.REWARDED_AD_UNIT_ID.isEmpty()){JSObject r=new JSObject();r.put("status","unavailable");call.resolve(r);return;}
  active=call;shown=false;receipt=null;int g=++generation;
  handler.postDelayed(()->{if(g==generation&&active!=null&&!shown)finish("unavailable");},15000);
  try{YandexAds.initialize(getContext(),()->getActivity().runOnUiThread(()->{
   try{
   if(g!=generation||active==null)return;
   if(loader==null)loader=new RewardedAdLoader(getActivity());
   loader.loadAd(new AdRequest.Builder(BuildConfig.REWARDED_AD_UNIT_ID).build(),new RewardedAdLoadListener(){
    @Override public void onAdFailedToLoad(@NonNull AdRequestError error){if(g==generation)finish("unavailable");}
    @Override public void onAdLoaded(@NonNull RewardedAd loaded){
     if(g!=generation||active==null){loaded.setAdEventListener(null);return;}ad=loaded;
     ad.setAdEventListener(new RewardedAdEventListener(){
      @Override public void onAdShown(){shown=true;}
      @Override public void onAdFailedToShow(@NonNull AdError error){if(g==generation)finish("failed");}
      @Override public void onAdDismissed(){if(g==generation)finish(receipt==null?"closed":"rewarded");}
      @Override public void onAdClicked(){}
      @Override public void onAdImpression(@Nullable ImpressionData data){}
      @Override public void onRewarded(@NonNull Reward reward){
       if(g!=generation||receipt!=null)return;JSObject r=new JSObject();r.put("token",UUID.randomUUID().toString());r.put("level",level);JSONArray pending=receipts();pending.put(r);
       receipt=r;prefs().edit().putString("pending",pending.toString()).commit();
      }
     });shown=true;try{ad.show(getActivity());}catch(Exception e){finish("failed");}
    }
   });
   }catch(Exception e){finish("failed");}
  }));}catch(Exception e){finish("failed");}
 });}
 private void finish(String status){PluginCall c=active;active=null;generation++;if(loader!=null&&!shown){try{loader.cancelLoading();}catch(Exception ignored){}}if(ad!=null){ad.setAdEventListener(null);ad=null;}shown=false;if(c!=null){JSObject r=new JSObject();r.put("status",status);if(receipt!=null)r.put("receipt",receipt);c.resolve(r);}receipt=null;}
 @Override protected void handleOnPause(){if(active!=null&&!shown)finish("closed");}
 @Override protected void handleOnDestroy(){finish(receipt==null?"closed":"rewarded");loader=null;handler.removeCallbacksAndMessages(null);}
}
