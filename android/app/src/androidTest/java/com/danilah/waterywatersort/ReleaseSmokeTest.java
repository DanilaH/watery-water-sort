package com.danilah.waterywatersort;

import android.webkit.WebView;
import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import android.graphics.Bitmap;
import java.io.File;
import java.io.FileOutputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Exercises the actual minified, signed release, not the debug WebView. */
@RunWith(AndroidJUnit4.class)
public class ReleaseSmokeTest {
    private void screenshot(String name) throws Exception {
        android.app.Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        Bitmap image = instrumentation.getUiAutomation().takeScreenshot();
        assertNotNull("Screenshot unavailable", image);
        File directory = new File(instrumentation.getTargetContext().getExternalFilesDir(null), "release-smoke");
        assertTrue(directory.isDirectory() || directory.mkdirs());
        try (FileOutputStream out = new FileOutputStream(new File(directory, name + ".png"))) {
            assertTrue(image.compress(Bitmap.CompressFormat.PNG, 100, out));
        }
        image.recycle();
    }
    private String js(ActivityScenario<MainActivity> scenario, String expression) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        scenario.onActivity(activity -> {
            WebView web = activity.getBridge().getWebView();
            web.evaluateJavascript(expression, value -> { result.set(value); done.countDown(); });
        });
        assertTrue("WebView did not answer", done.await(10, TimeUnit.SECONDS));
        return result.get();
    }

    private void waitFor(ActivityScenario<MainActivity> scenario, String expression) throws Exception {
        long deadline = System.currentTimeMillis() + 30000;
        while (System.currentTimeMillis() < deadline) {
            if ("true".equals(js(scenario, "Boolean(" + expression + ")"))) return;
            Thread.sleep(200);
        }
        fail("Timed out: " + expression + "; body=" +
            js(scenario, "document.body && document.body.innerText.slice(0,1500)"));
    }

    @Test public void releaseStartsPlaysOpensSettingsAndKeepsNativeBridges() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            waitFor(scenario, "document.body && !document.body.hasAttribute('data-booting') && document.querySelector('#home-play')");
            screenshot("home");
            js(scenario, "document.querySelector('#home-play').click()");
            waitFor(scenario, "!document.body.classList.contains('home') && document.querySelector('canvas')?.width > 0");
            screenshot("game");
            js(scenario, "document.querySelector('#settings').click()");
            waitFor(scenario, "document.querySelector('#dialog[open] .pause-preferences')");
            js(scenario, "document.querySelector('.pause-preferences').click()");
            waitFor(scenario, "document.querySelectorAll('.setting input').length === 4");
            screenshot("settings");
            // Settings handlers must still save through the production WebView origin.
            js(scenario, "document.querySelector('.setting input').click()");
            String saved = js(scenario, "JSON.parse(localStorage.getItem('water-sort-v1')).settings.sound");
            assertEquals("false", saved);
            js(scenario, "document.querySelector('.dialog-close').click()");
            waitFor(scenario, "document.querySelector('.pause-resume')");
            js(scenario, "document.querySelector('.pause-resume').click()");
            waitFor(scenario, "!document.querySelector('#dialog').open");
            // No ad is shown or reward granted by this probe. It checks reflected methods,
            // persisted reward receipts, native vibration and analytics bridge availability.
            js(scenario, "(async()=>{try{const c=window.Capacitor; await c.nativePromise('FeelHaptics','impact',{event:'select'}); await c.nativePromise('WaterRewarded','pending',{}); await c.nativePromise('WaterAds','bannerDiagnostics',{}); await c.nativePromise('WaterAnalytics','event',{name:'release_smoke_probe',data:{}}); window.__releaseSmoke='ok';}catch(e){window.__releaseSmoke=String(e);}})()");
            waitFor(scenario, "window.__releaseSmoke");
            assertEquals("\"ok\"", js(scenario, "window.__releaseSmoke"));
            scenario.moveToState(Lifecycle.State.CREATED);
            scenario.moveToState(Lifecycle.State.RESUMED);
            waitFor(scenario, "!document.body.hasAttribute('data-booting') && !document.querySelector('#dialog').open");
            assertEquals(saved, js(scenario, "JSON.parse(localStorage.getItem('water-sort-v1')).settings.sound"));
            screenshot("resumed");
            // Activity recreation reloads the production assets and existing save.
            scenario.recreate();
            waitFor(scenario, "document.body && !document.body.hasAttribute('data-booting') && document.querySelector('#home-play')?.textContent === 'Продолжить'");
            assertEquals(saved, js(scenario, "JSON.parse(localStorage.getItem('water-sort-v1')).settings.sound"));
        }
    }
}
