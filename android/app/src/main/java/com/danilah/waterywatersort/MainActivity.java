package com.danilah.waterywatersort;

import android.os.Build;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(FeelHapticsPlugin.class);
        registerPlugin(WaterRewardedPlugin.class);
        registerPlugin(WaterAdsPlugin.class);
        registerPlugin(WaterAnalyticsPlugin.class);
        super.onCreate(savedInstanceState);
        styleNavigationBar();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) styleNavigationBar();
    }

    private void styleNavigationBar() {
        // Edge-to-edge draws the game behind the bar. Remove Android's light
        // three-button scrim and keep the system controls legible over it.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setNavigationBarContrastEnforced(false);
        }
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView())
            .setAppearanceLightNavigationBars(false);
    }
}
