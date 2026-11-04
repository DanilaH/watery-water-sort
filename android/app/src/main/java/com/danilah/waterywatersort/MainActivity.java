package com.danilah.waterywatersort;

import android.os.Bundle;
import android.content.pm.ActivityInfo;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(FeelHapticsPlugin.class);
        registerPlugin(WaterRewardedPlugin.class);
        registerPlugin(WaterAdsPlugin.class);
        registerPlugin(WaterAnalyticsPlugin.class);
        super.onCreate(savedInstanceState);
        if (getResources().getConfiguration().smallestScreenWidthDp < 600) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        }
    }
}
