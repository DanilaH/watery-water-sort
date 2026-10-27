package com.danilah.waterywatersort;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(FeelHapticsPlugin.class);
        registerPlugin(WaterRewardedPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
