package com.danilah.waterywatersort;

import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.Settings;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** One immediate material beat per visual event; no delayed native vibration queues. */
@CapacitorPlugin(name = "FeelHaptics")
public class FeelHapticsPlugin extends Plugin {
    private Vibrator vibrator() {
        if (Build.VERSION.SDK_INT >= 31) {
            VibratorManager manager = (VibratorManager)getContext().getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return manager == null ? null : manager.getDefaultVibrator();
        }
        return (Vibrator)getContext().getSystemService(Context.VIBRATOR_SERVICE);
    }
    @PluginMethod
    public void impact(PluginCall call) {
        String event = call.getString("event", "select");
        getActivity().runOnUiThread(() -> {
            if (!getBridge().getWebView().hasWindowFocus() || Settings.System.getInt(getContext().getContentResolver(), Settings.System.HAPTIC_FEEDBACK_ENABLED, 1) == 0) {call.resolve();return;}
            Vibrator v = vibrator();
            if (v == null || !v.hasVibrator()) {call.resolve();return;}
            int duration=22, amplitude=155;
            switch (event) {
                case "collect": duration=15;amplitude=125;break;
                case "land": duration=24;amplitude=165;break;
                case "accept": duration=26;amplitude=175;break;
                case "color": duration=30;amplitude=175;break;
                case "colorRise": duration=40;amplitude=210;break;
                case "colorSeal": duration=55;amplitude=245;break;
                case "victory": duration=40;amplitude=185;break;
                case "victoryRise": duration=50;amplitude=220;break;
                case "victoryPeak": duration=65;amplitude=255;break;
            }
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(duration, v.hasAmplitudeControl() ? amplitude : VibrationEffect.DEFAULT_AMPLITUDE));
            else v.vibrate(duration);
            call.resolve();
        });
    }
    @PluginMethod
    public void cancel(PluginCall call) {Vibrator v=vibrator();if(v!=null)v.cancel();call.resolve();}
    @Override protected void handleOnPause() {Vibrator v=vibrator();if(v!=null)v.cancel();}
}
