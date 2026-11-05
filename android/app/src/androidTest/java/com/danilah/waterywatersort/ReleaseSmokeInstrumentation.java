package com.danilah.waterywatersort;

import android.webkit.WebView;
import android.graphics.Bitmap;
import java.io.File;
import java.io.FileOutputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/** Exercises the actual minified, signed release, not the debug WebView. */
public class ReleaseSmokeInstrumentation extends android.app.Instrumentation {
    private static void assertTrue(String message, boolean value) { if (!value) throw new AssertionError(message); }
    private static void assertTrue(boolean value) { assertTrue("Expected true", value); }
    private static void assertNotNull(String message, Object value) { assertTrue(message, value != null); }
    private static void assertEquals(Object a, Object b) { assertTrue(String.valueOf(a) + " != " + b, java.util.Objects.equals(a,b)); }
    private static void fail(String message) { throw new AssertionError(message); }
    @Override public void onCreate(android.os.Bundle arguments) { super.onCreate(arguments); start(); }
    @Override public void onStart() {
        android.os.Bundle results = new android.os.Bundle();
        try { smoke(); results.putString("stream", "\nOK (release smoke)\n"); finish(android.app.Activity.RESULT_OK, results); }
        catch (Throwable error) { android.util.Log.e("ReleaseSmoke", "Smoke failed", error); results.putString("stream", android.util.Log.getStackTraceString(error)); finish(android.app.Activity.RESULT_CANCELED, results); }
    }
    private MainActivity launch() { return (MainActivity) startActivitySync(new android.content.Intent(getTargetContext(), MainActivity.class).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)); }
    private void screenshot(String name) throws Exception {
        android.app.Instrumentation instrumentation = this;
        Bitmap image = instrumentation.getUiAutomation().takeScreenshot();
        assertNotNull("Screenshot unavailable", image);
        File directory = new File(instrumentation.getTargetContext().getExternalFilesDir(null), "release-smoke");
        assertTrue(directory.isDirectory() || directory.mkdirs());
        try (FileOutputStream out = new FileOutputStream(new File(directory, name + ".png"))) {
            assertTrue(image.compress(Bitmap.CompressFormat.PNG, 100, out));
        }
        image.recycle();
    }
    private String js(MainActivity activity, String expression) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        runOnMainSync(() -> {
            WebView web = webView(activity.getWindow().getDecorView());
            assertNotNull("Game WebView not found", web);
            web.evaluateJavascript(expression, value -> { result.set(value); done.countDown(); });
        });
        assertTrue("WebView did not answer", done.await(10, TimeUnit.SECONDS));
        return result.get();
    }

    // Find the real Android view without depending on Capacitor methods that
    // R8 is allowed to inline or merge in the shipped APK.
    private WebView webView(android.view.View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof android.view.ViewGroup) {
            android.view.ViewGroup group = (android.view.ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                WebView found = webView(group.getChildAt(i));
                if (found != null) return found;
            }
        }
        return null;
    }

    private void waitFor(MainActivity activity, String expression) throws Exception {
        long deadline = System.currentTimeMillis() + 30000;
        while (System.currentTimeMillis() < deadline) {
            if ("true".equals(js(activity, "Boolean(" + expression + ")"))) return;
            Thread.sleep(200);
        }
        fail("Timed out: " + expression + "; body=" +
            js(activity, "document.body && document.body.innerText.slice(0,1500)"));
    }

    private void smoke() throws Exception {
        MainActivity activity = launch();
        try {
            waitFor(activity, "document.body && !document.body.hasAttribute('data-booting') && document.querySelector('#home-play')");
            screenshot("home");
            js(activity, "document.querySelector('#home-play').click()");
            waitFor(activity, "!document.body.classList.contains('home') && document.querySelector('canvas')?.width > 0");
            screenshot("game");
            js(activity, "document.querySelector('#settings').click()");
            waitFor(activity, "document.querySelector('#dialog[open] .pause-preferences')");
            js(activity, "document.querySelector('.pause-preferences').click()");
            waitFor(activity, "document.querySelectorAll('.setting input').length === 4");
            screenshot("settings");
            // Settings handlers must still save through the production WebView origin.
            js(activity, "document.querySelector('.setting input').click()");
            String saved = js(activity, "JSON.parse(localStorage.getItem('water-sort-v1')).settings.sound");
            assertEquals("false", saved);
            js(activity, "document.querySelector('.dialog-close').click()");
            waitFor(activity, "document.querySelector('.pause-resume')");
            js(activity, "document.querySelector('.pause-resume').click()");
            waitFor(activity, "!document.querySelector('#dialog').open");
            // No ad is shown or reward granted by this probe. It checks reflected methods,
            // persisted reward receipts, native vibration and analytics bridge availability.
            js(activity, "(async()=>{try{const c=window.Capacitor; await c.nativePromise('FeelHaptics','impact',{event:'select'}); await c.nativePromise('WaterRewarded','pending',{}); await c.nativePromise('WaterAds','bannerDiagnostics',{}); await c.nativePromise('WaterAnalytics','event',{name:'release_smoke_probe',data:{}}); window.__releaseSmoke='ok';}catch(e){window.__releaseSmoke=String(e);}})()");
            waitFor(activity, "window.__releaseSmoke");
            assertEquals("\"ok\"", js(activity, "window.__releaseSmoke"));
            try (java.io.InputStream out = new android.os.ParcelFileDescriptor.AutoCloseInputStream(getUiAutomation().executeShellCommand("input keyevent KEYCODE_HOME"))) { out.readAllBytes(); }
            Thread.sleep(700);
            try (java.io.InputStream out = new android.os.ParcelFileDescriptor.AutoCloseInputStream(getUiAutomation().executeShellCommand("am start -n com.danilah.waterywatersort/.MainActivity"))) { out.readAllBytes(); }
            waitFor(activity, "!document.body.hasAttribute('data-booting') && !document.querySelector('#dialog').open");
            assertEquals(saved, js(activity, "JSON.parse(localStorage.getItem('water-sort-v1')).settings.sound"));
            screenshot("resumed");
            // Activity recreation reloads the production assets and existing save.
            MainActivity previous = activity;
            runOnMainSync(previous::finish);
            waitForIdleSync();
            MainActivity fresh = launch();
            waitFor(fresh, "document.body && !document.body.hasAttribute('data-booting') && document.querySelector('#home-play')?.textContent === 'Продолжить'");
            assertEquals(saved, js(fresh, "JSON.parse(localStorage.getItem('water-sort-v1')).settings.sound"));
            runOnMainSync(fresh::finish);
        } finally { runOnMainSync(activity::finish); }
    }
}
