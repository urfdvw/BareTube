package io.github.urfdvw.baretube

import android.content.Context
import android.webkit.WebView

/**
 * The WebView is told the truth about its visibility: when hidden, Chromium
 * stops decoding video and keeps playing the audio only. (Pretending to stay
 * visible made the video decoder wait for frames nobody draws, which stalled
 * audio too.) Pages still see themselves as visible via KEEP_VISIBLE_JS.
 */
class BackgroundWebView(context: Context) : WebView(context) {
    override fun onWindowVisibilityChanged(visibility: Int) {
        DebugLog.log("window visibility $visibility")
        super.onWindowVisibilityChanged(visibility)
    }
}
