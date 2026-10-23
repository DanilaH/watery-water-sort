package com.danilah.waterywatersort;

import android.os.Build;
import android.view.HapticFeedbackConstants;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** View feedback respects Android's touch-feedback setting; no vibration override flags. */
@CapacitorPlugin(name = "FeelHaptics")
public class FeelHapticsPlugin extends Plugin {
    @PluginMethod
    public void impact(PluginCall call) {
        boolean strong = Boolean.TRUE.equals(call.getBoolean("strong", false));
        getActivity().runOnUiThread(() -> {
            int feedback = strong && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                ? HapticFeedbackConstants.CONFIRM
                : HapticFeedbackConstants.CLOCK_TICK;
            getBridge().getWebView().performHapticFeedback(feedback);
            call.resolve();
        });
    }
}
