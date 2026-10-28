package io.github.urfdvw.baretube

import android.content.Context
import android.view.View
import android.webkit.WebView

/**
 * A WebView that never tells Chromium it went invisible: WebView pauses the
 * video of hidden pages. While the app is in the background,
 * [OffscreenRenderer] keeps drawing it so decoded frames are consumed.
 */
class BackgroundWebView(context: Context) : WebView(context) {
    override fun onWindowVisibilityChanged(visibility: Int) {
        DebugLog.log("window visibility $visibility (reported as VISIBLE)")
        super.onWindowVisibilityChanged(View.VISIBLE)
    }

    override fun onVisibilityChanged(changedView: View, visibility: Int) {
        super.onVisibilityChanged(changedView, View.VISIBLE)
    }
}
