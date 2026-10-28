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
        String event = call.getString("event", "select");
        getActivity().runOnUiThread(() -> {
            // A paused/background WebView must not replay queued UI feedback.
            if (!getBridge().getWebView().hasWindowFocus()) { call.resolve(); return; }
            int feedback = HapticFeedbackConstants.CLOCK_TICK;
            if ("collect".equals(event)) {
                // Frequent reward arrivals must stay very soft; unsupported devices may omit it.
                if (Build.VERSION.SDK_INT >= 34) feedback = HapticFeedbackConstants.SEGMENT_FREQUENT_TICK;
                else if (Build.VERSION.SDK_INT >= 27) feedback = HapticFeedbackConstants.TEXT_HANDLE_MOVE;
                else { call.resolve(); return; }
            } else if ("color".equals(event) || "victory".equals(event)) {
                if (Build.VERSION.SDK_INT >= 30) feedback = HapticFeedbackConstants.CONFIRM;
                else feedback = HapticFeedbackConstants.VIRTUAL_KEY;
            } else if ("accept".equals(event) && Build.VERSION.SDK_INT >= 30) {
                feedback = HapticFeedbackConstants.GESTURE_END;
            } else if (Build.VERSION.SDK_INT >= 34) {
                feedback = HapticFeedbackConstants.SEGMENT_TICK;
            }
            getBridge().getWebView().performHapticFeedback(feedback);
            call.resolve();
        });
    }
}
