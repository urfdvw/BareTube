package io.github.urfdvw.baretube

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import androidx.webkit.WebViewCompat

/**
 * Opened by the "Share debug log" launcher shortcut. Separate from MainActivity
 * because shortcuts clear their task, which would stop playback.
 */
class ShareLogActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        DebugLog.init(this)
        val power = getSystemService(PowerManager::class.java)
        val info = "BareTube ${BuildConfig.VERSION_NAME}, Android ${Build.VERSION.RELEASE} (SDK ${Build.VERSION.SDK_INT}), " +
            "${Build.MANUFACTURER} ${Build.MODEL}, WebView ${WebViewCompat.getCurrentWebViewPackage(this)?.versionName}, " +
            "battery optimization ignored=${power.isIgnoringBatteryOptimizations(packageName)}\n\n"
        val send = Intent(Intent.ACTION_SEND)
            .setType("text/plain")
            .putExtra(Intent.EXTRA_SUBJECT, "BareTube debug log")
            .putExtra(Intent.EXTRA_TEXT, info + DebugLog.tail())
        startActivity(Intent.createChooser(send, "Share debug log"))
        finish()
    }
}
