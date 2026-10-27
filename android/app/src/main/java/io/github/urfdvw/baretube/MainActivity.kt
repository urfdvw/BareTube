package io.github.urfdvw.baretube

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject

class MainActivity : ComponentActivity() {

    companion object {
        const val ACTION_SIGN_IN = "io.github.urfdvw.baretube.SIGN_IN"
        private val APP_URL = Uri.parse(BuildConfig.APP_URL)
        private val APP_ORIGIN = "${APP_URL.scheme}://${APP_URL.host}"
        private val YOUTUBE_ORIGINS = setOf("https://www.youtube.com", "https://www.youtube-nocookie.com")
        private const val SIGN_IN_URL =
            "https://accounts.google.com/ServiceLogin?service=youtube&passive=true&continue=https%3A%2F%2Fm.youtube.com%2F"

        // Runs in every frame (including the YouTube embed) before page scripts,
        // so players never see the page as hidden.
        private const val KEEP_VISIBLE_JS = """
            (function () {
              try {
                var proto = Document.prototype;
                Object.defineProperty(proto, 'hidden', { get: function () { return false; }, configurable: true });
                Object.defineProperty(proto, 'webkitHidden', { get: function () { return false; }, configurable: true });
                Object.defineProperty(proto, 'visibilityState', { get: function () { return 'visible'; }, configurable: true });
                Object.defineProperty(proto, 'webkitVisibilityState', { get: function () { return 'visible'; }, configurable: true });
                var block = function (e) { e.stopImmediatePropagation(); };
                window.addEventListener('visibilitychange', block, true);
                window.addEventListener('webkitvisibilitychange', block, true);
              } catch (e) {}
            })();
        """

        // Runs in the YouTube embed: reports the <video> state to the app and
        // obeys play/pause commands from the notification / lock screen.
        private const val MEDIA_JS = """
            (function () {
              var m = location.pathname.match(/^\/embed\/([^\/?#]+)/);
              if (!m) return;
              var last = '';
              function send(state) {
                var b = window.BareTubeMedia;
                if (!b || state === last) return;
                last = state;
                if (!b.onmessage) b.onmessage = function (e) {
                  var v = document.querySelector('video');
                  if (!v) return;
                  if (e.data === 'play') v.play(); else if (e.data === 'pause') v.pause();
                };
                var t = document.querySelector('.ytp-title-link');
                var title = (t && t.textContent) || document.title.replace(/ - YouTube$/, '');
                b.postMessage(JSON.stringify({ state: state, title: title, videoId: m[1] }));
              }
              document.addEventListener('playing', function () { send('playing'); }, true);
              document.addEventListener('pause', function () { send('paused'); }, true);
              window.addEventListener('pagehide', function () { send('stopped'); });
            })();
        """

        /** A pause this close to the app going to the background was caused by it, not by the user. */
        private const val AUTO_PAUSE_WINDOW_MS = 2000L
    }

    private lateinit var root: FrameLayout
    private lateinit var webView: WebView
    private var fullscreenView: View? = null
    private var fullscreenCallback: WebChromeClient.CustomViewCallback? = null
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingSave: String? = null
    private var signingIn = false
    private var clearHistoryOnLoad = false
    private var mediaReply: JavaScriptReplyProxy? = null
    private var stoppedAt = 0L
    private var lastPauseAt = 0L
    private var commandedPauseAt = 0L

    private val pickFile = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        fileCallback?.onReceiveValue(if (uri != null) arrayOf(uri) else null)
        fileCallback = null
    }

    private val createFile = registerForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        val content = pendingSave
        pendingSave = null
        if (uri == null || content == null) return@registerForActivityResult
        try {
            contentResolver.openOutputStream(uri)?.use { it.write(content.toByteArray()) }
            Toast.makeText(this, "Backup saved", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Toast.makeText(this, "Could not save backup", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightStatusBars = false
        root = FrameLayout(this).apply { setBackgroundColor(Color.parseColor("#0f0f0f")) }
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            view.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom))
            WindowInsetsCompat.CONSUMED
        }

        webView = BackgroundWebView(this)
        root.addView(webView, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        setContentView(root)

        setUpWebView()
        PlaybackService.commandHandler = { cmd ->
            if (cmd == "pause") commandedPauseAt = SystemClock.elapsedRealtime()
            mediaReply?.postMessage(cmd)
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                when {
                    fullscreenView != null -> fullscreenCallback?.onCustomViewHidden()
                    webView.canGoBack() -> webView.goBack()
                    // Keep the WebView (and playback) alive instead of finishing.
                    else -> moveTaskToBack(true)
                }
            }
        })

        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            registerForActivityResult(ActivityResultContracts.RequestPermission()) {}
                .launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        when {
            intent?.action == ACTION_SIGN_IN -> startSignIn()
            savedInstanceState == null -> webView.loadUrl(BuildConfig.APP_URL)
            else -> webView.restoreState(savedInstanceState)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (intent.action == ACTION_SIGN_IN) startSignIn()
    }

    private fun startSignIn() {
        signingIn = true
        webView.loadUrl(SIGN_IN_URL)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setUpWebView() {
        webView.setBackgroundColor(Color.parseColor("#0f0f0f"))
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            // Google refuses sign-in from user agents that look like a WebView.
            userAgentString = userAgentString
                .replace("; wv)", ")")
                .replace(Regex("""Version/\d+(\.\d+)* """), "")
        }

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            // The YouTube embed lives on another site than the app, so its login cookies are third-party.
            setAcceptThirdPartyCookies(webView, true)
        }

        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(webView, KEEP_VISIBLE_JS, setOf("*"))
            WebViewCompat.addDocumentStartJavaScript(webView, MEDIA_JS, YOUTUBE_ORIGINS)
        }

        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(webView, "BareTubeMedia", YOUTUBE_ORIGINS) { _, message, _, _, reply ->
                val msg = try { JSONObject(message.data ?: "") } catch (e: Exception) { return@addWebMessageListener }
                mediaReply = reply
                onMediaState(msg)
            }
        }

        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            // Only exposed to frames from the app's own origin, not to YouTube or Google pages.
            WebViewCompat.addWebMessageListener(webView, "BareTubeAndroid", setOf(APP_ORIGIN)) { _, message, _, isMainFrame, reply ->
                if (!isMainFrame) return@addWebMessageListener
                val data = message.data ?: return@addWebMessageListener
                val msg = try { JSONObject(data) } catch (e: Exception) { return@addWebMessageListener }
                when (msg.optString("type")) {
                    "saveFile" -> {
                        pendingSave = msg.optString("content")
                        createFile.launch(msg.optString("name", "baretube-backup.json"))
                    }
                    "signIn" -> startSignIn()
                    "signOut" -> CookieManager.getInstance().apply {
                        removeAllCookies(null)
                        flush()
                    }
                    "getAccount" -> reply.postMessage(
                        JSONObject().put("type", "account").put("signedIn", isSignedIn()).toString()
                    )
                }
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (!request.isForMainFrame) return false
                val url = request.url
                if (isAppUrl(url)) return false
                // Any Google login page (e.g. from the player's "Sign in" prompt) stays in the app,
                // so the cookies end up in the app and not in an external browser.
                if (url.host == "accounts.google.com") signingIn = true
                if (signingIn) {
                    // Stay inside the WebView for the Google / YouTube login flow; ignore app intents.
                    return url.scheme != "https" || !isGoogleHost(url.host)
                }
                openExternally(url)
                return true
            }

            override fun onPageFinished(view: WebView, url: String) {
                if (clearHistoryOnLoad) {
                    clearHistoryOnLoad = false
                    view.clearHistory()
                }
                val uri = Uri.parse(url)
                val host = uri.host ?: ""
                if (isAppUrl(uri)) signingIn = false
                if (signingIn && host.endsWith("youtube.com") && uri.path?.startsWith("/signin") != true) {
                    // Login finished and YouTube set its cookies: return to the app.
                    signingIn = false
                    CookieManager.getInstance().flush()
                    Toast.makeText(
                        this@MainActivity,
                        if (isSignedIn()) "Signed in to YouTube" else "YouTube sign-in not completed",
                        Toast.LENGTH_LONG
                    ).show()
                    clearHistoryOnLoad = true
                    view.loadUrl(BuildConfig.APP_URL + "#/settings")
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowCustomView(view: View, callback: CustomViewCallback) {
                if (fullscreenView != null) {
                    callback.onCustomViewHidden()
                    return
                }
                fullscreenView = view
                fullscreenCallback = callback
                root.addView(view, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
                WindowCompat.getInsetsController(window, window.decorView).apply {
                    hide(WindowInsetsCompat.Type.systemBars())
                    systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                }
                requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
            }

            override fun onHideCustomView() {
                fullscreenView?.let { root.removeView(it) }
                fullscreenView = null
                fullscreenCallback = null
                WindowCompat.getInsetsController(window, window.decorView).show(WindowInsetsCompat.Type.systemBars())
                requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            }

            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = filePathCallback
                return try {
                    pickFile.launch("*/*")
                    true
                } catch (e: ActivityNotFoundException) {
                    fileCallback = null
                    false
                }
            }
        }
    }

    private fun onMediaState(msg: JSONObject) {
        val state = msg.optString("state")
        if (state == "stopped") {
            PlaybackService.stop()
            return
        }
        val videoId = msg.optString("videoId")
        PlaybackService.update(
            this,
            state == "playing",
            msg.optString("title"),
            "",
            if (videoId.isNotEmpty()) "https://i.ytimg.com/vi/$videoId/hqdefault.jpg" else ""
        )
        if (state == "paused") {
            lastPauseAt = SystemClock.elapsedRealtime()
            resumeIfPausedByBackground()
        }
    }

    // Safety net: if the player still pauses itself when the app is backgrounded
    // or the screen locks, start it again (unless the user paused from the notification).
    private fun resumeIfPausedByBackground() {
        val now = SystemClock.elapsedRealtime()
        if (stoppedAt == 0L || lastPauseAt == 0L) return
        if (Math.abs(lastPauseAt - stoppedAt) > AUTO_PAUSE_WINDOW_MS) return
        if (now - commandedPauseAt < AUTO_PAUSE_WINDOW_MS) return
        lastPauseAt = 0L
        mediaReply?.postMessage("play")
    }

    private fun isAppUrl(url: Uri): Boolean =
        url.scheme == APP_URL.scheme && url.host == APP_URL.host && (url.path ?: "").startsWith(APP_URL.path ?: "/")

    private fun isGoogleHost(host: String?): Boolean {
        if (host == null) return false
        return listOf("google.com", "youtube.com", "gstatic.com", "googleusercontent.com")
            .any { host == it || host.endsWith(".$it") } ||
            Regex("""(^|\.)google\.[a-z.]+$""").containsMatchIn(host)
    }

    private fun isSignedIn(): Boolean {
        val cookies = CookieManager.getInstance().getCookie("https://www.youtube.com") ?: return false
        return cookies.contains("LOGIN_INFO=") || cookies.contains("SAPISID=")
    }

    private fun openExternally(url: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, url))
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, "No app can open this link", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onStart() {
        super.onStart()
        stoppedAt = 0L
    }

    override fun onStop() {
        super.onStop()
        stoppedAt = SystemClock.elapsedRealtime()
        resumeIfPausedByBackground()
    }

    override fun onPause() {
        super.onPause()
        // Deliberately not calling webView.onPause(): that would stop playback.
        CookieManager.getInstance().flush()
    }

    override fun onDestroy() {
        PlaybackService.commandHandler = null
        PlaybackService.stop()
        root.removeAllViews()
        webView.destroy()
        super.onDestroy()
    }
}
