package com.danilah.waterywatersort;

import android.app.Application;
import io.appmetrica.analytics.AppMetrica;
import io.appmetrica.analytics.AppMetricaConfig;

public class WaterApplication extends Application {
 static volatile boolean analyticsReady=false;
 @Override public void onCreate(){
  super.onCreate();if(BuildConfig.ANALYTICS_API_KEY.isEmpty())return;
  try{AppMetrica.activate(this,AppMetricaConfig.newConfigBuilder(BuildConfig.ANALYTICS_API_KEY).withLocationTracking(false).build());AppMetrica.enableActivityAutoTracking(this);analyticsReady=true;}
  catch(Exception ignored){/* Analytics must never block offline play. */}
 }
}
