package com.danilah.waterywatersort;

import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import io.appmetrica.analytics.AppMetrica;
import java.util.*;

@CapacitorPlugin(name="WaterAnalytics")
public class WaterAnalyticsPlugin extends Plugin {
 private static final Set<String> EVENTS=new HashSet<>(Arrays.asList("level_start","level_resume","tutorial_complete","save_recovered","extra_tube_offer","level_complete","level_leave","level_restart","undo","hint_request","hint_result","reward_request","reward_result","reward_granted","save_error"));
 private static final Set<String> KEYS=new HashSet<>(Arrays.asList("level","stage","revision","moves","extra","reason","status","stars","first","active_ms"));
 @PluginMethod public void event(PluginCall call){
  boolean sent=false;String name=call.getString("name","");JSObject data=call.getObject("data");
  if(WaterApplication.analyticsReady&&EVENTS.contains(name)&&data!=null){try{
   Map<String,Object> fields=new HashMap<>();Iterator<String> keys=data.keys();
   while(keys.hasNext()){String key=keys.next();Object value=data.opt(key);if(KEYS.contains(key)&&(value instanceof Boolean||value instanceof Number||value instanceof String&&((String)value).length()<=80))fields.put(key,value);}
   AppMetrica.reportEvent(name,fields);sent=true;
  }catch(Exception ignored){}}
  JSObject result=new JSObject();result.put("sent",sent);call.resolve(result);
 }
}
