package io.github.urfdvw.baretube

import android.content.Context
import android.view.View
import android.webkit.WebView

/**
 * A WebView that never tells Chromium it went invisible, so media keeps
 * playing when the app is in the background or the screen is locked.
 */
class BackgroundWebView(context: Context) : WebView(context) {
    override fun onWindowVisibilityChanged(visibility: Int) {
        super.onWindowVisibilityChanged(View.VISIBLE)
    }

    override fun onVisibilityChanged(changedView: View, visibility: Int) {
        super.onVisibilityChanged(changedView, View.VISIBLE)
    }
}
