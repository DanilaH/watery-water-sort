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
import java.util.Map;
import java.util.LinkedHashMap;

/** Award receipt is durable before JS sees success; acknowledgement follows the game save. */
@CapacitorPlugin(name="WaterRewarded")
public class WaterRewardedPlugin extends Plugin {
 private final Handler handler=new Handler(Looper.getMainLooper());
 private RewardedAdLoader loader;private RewardedAd ad;private PluginCall active;
 private boolean shown=false;private int generation=0;private JSObject receipt;
 private SharedPreferences prefs(){return getContext().getSharedPreferences("water-reward-receipts",0);}
 // One process-wide journal survives Activity recreation even when disk writes fail.
 private static RewardLedger journal;
 private RewardLedger ledger(){if(journal==null)journal=newLedger(prefs());return journal;}
 private static RewardLedger newLedger(final SharedPreferences storage){
  return new RewardLedger(new RewardLedger.Store(){
   public Map<String,String> read(){try{
    JSONArray rows=new JSONArray(storage.getString("pending","[]"));Map<String,String> result=new LinkedHashMap<>();
    for(int i=0;i<rows.length();i++){JSONObject r=rows.getJSONObject(i);String token=r.getString("token"),level=r.getString("level");if(token.isEmpty()||!level.matches("water-\\d{3}@\\d+"))throw new IllegalStateException("Invalid receipt");result.put(token,level);}return result;
   }catch(Exception e){throw new IllegalStateException("Receipt journal unavailable",e);}}
   public boolean write(Map<String,String> rows){JSONArray next=new JSONArray();for(Map.Entry<String,String> row:rows.entrySet()){JSObject r=new JSObject();r.put("token",row.getKey());r.put("level",row.getValue());next.put(r);}return storage.edit().putString("pending",next.toString()).commit();}
  });
 }
 private JSONArray receipts(){JSONArray result=new JSONArray();for(Map.Entry<String,String> row:ledger().pending().entrySet()){JSObject r=new JSObject();r.put("token",row.getKey());r.put("level",row.getValue());result.put(r);}return result;}
 @PluginMethod public void pending(PluginCall call){getActivity().runOnUiThread(()->{try{ledger().flush();JSObject r=new JSObject();r.put("receipts",receipts());call.resolve(r);}catch(Exception e){call.reject("Receipt journal unavailable");}});}
 @PluginMethod public void ack(PluginCall call){getActivity().runOnUiThread(()->{try{if(!ledger().ack(call.getString("token",""))){call.reject("Receipt acknowledgement failed");return;}call.resolve();}catch(Exception e){call.reject("Receipt journal unavailable");}});}
 @PluginMethod public void cancel(PluginCall call){getActivity().runOnUiThread(()->{if(active!=null&&!shown)finish("closed");call.resolve();});}
 @PluginMethod public void request(PluginCall call){getActivity().runOnUiThread(()->{
  String level=call.getString("level","");if(!level.matches("water-\\d{3}@\\d+")||active!=null||BuildConfig.REWARDED_AD_UNIT_ID.isEmpty()){JSObject r=new JSObject();r.put("status","unavailable");call.resolve(r);return;}
  try{for(Map.Entry<String,String> row:ledger().pending().entrySet())if(level.equals(row.getValue())){JSObject r=new JSObject(),existing=new JSObject();existing.put("token",row.getKey());existing.put("level",level);r.put("status","rewarded");r.put("receipt",existing);call.resolve(r);return;}}
  catch(Exception e){JSObject r=new JSObject();r.put("status","unavailable");call.resolve(r);return;}
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
      @Override public void onAdShown(){if(g==generation)shown=true;}
      @Override public void onAdFailedToShow(@NonNull AdError error){if(g==generation)finish("failed");}
      @Override public void onAdDismissed(){if(g==generation)finish(receipt==null?"closed":"rewarded");}
      @Override public void onAdClicked(){}
      @Override public void onAdImpression(@Nullable ImpressionData data){}
      @Override public void onRewarded(@NonNull Reward reward){
       if(g!=generation||receipt!=null)return;String token=UUID.randomUUID().toString();JSObject r=new JSObject();r.put("token",token);r.put("level",level);receipt=r;ledger().record(token,level);
      }
     });shown=true;try{ad.show(getActivity());}catch(Exception e){finish("failed");}
    }
   });
   }catch(Exception e){finish("failed");}
  }));}catch(Exception e){finish("failed");}
 });}
 private void finish(String status){PluginCall c=active;active=null;generation++;handler.removeCallbacksAndMessages(null);if(loader!=null&&!shown){try{loader.cancelLoading();}catch(Exception ignored){}}if(ad!=null){ad.setAdEventListener(null);ad=null;}shown=false;if(c!=null){JSObject r=new JSObject();r.put("status",receipt==null?status:"rewarded");if(receipt!=null)r.put("receipt",receipt);c.resolve(r);}receipt=null;}
 @Override protected void handleOnPause(){if(active!=null&&!shown)finish("closed");}
 @Override protected void handleOnDestroy(){try{if(journal!=null)journal.flush();}catch(Exception ignored){}finish(receipt==null?"closed":"rewarded");loader=null;handler.removeCallbacksAndMessages(null);}
}
