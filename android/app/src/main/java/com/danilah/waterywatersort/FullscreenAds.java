package com.danilah.waterywatersort;
import android.content.Context;
/** Shared by rewarded and interstitial. Never expires a genuinely shown SDK screen. */
final class FullscreenAds {
 private static Object owner;static Runnable visibility;
 static synchronized boolean acquire(Object who){if(owner!=null)return false;owner=who;if(visibility!=null)visibility.run();return true;}
 static synchronized boolean busy(){return owner!=null;}
 static synchronized void release(Object who,Context context,boolean wasShown){if(owner!=who)return;if(wasShown)context.getSharedPreferences("water-ads",0).edit().putLong("closed",System.currentTimeMillis()).commit();owner=null;if(visibility!=null)visibility.run();}
 static boolean cooled(Context c){long now=System.currentTimeMillis(),last=c.getSharedPreferences("water-ads",0).getLong("closed",0);if(last>now){c.getSharedPreferences("water-ads",0).edit().putLong("closed",now).commit();return false;}return last==0||now-last>=60000;}
}
