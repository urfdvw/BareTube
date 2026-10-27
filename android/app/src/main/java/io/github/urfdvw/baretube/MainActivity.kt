package io.github.urfdvw.baretube

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.RenderProcessGoneDetail
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
        // so players never see the page as hidden and don't pause themselves.
        //
        // Hidden pages get no animation frames, but the player believes it is
        // visible and may wait for them; when no real frame arrives within 100 ms,
        // the callback is run from a timer instead.
        private const val KEEP_VISIBLE_JS = """
            (function () {
              try {
                var proto = Document.prototype;
                var real = Object.getOwnPropertyDescriptor(proto, 'visibilityState');
                // What Chromium really reports, for the debug log.
                Object.defineProperty(window, '__btRealVisibility', { value: function () { return real.get.call(document); } });
                Object.defineProperty(proto, 'hidden', { get: function () { return false; }, configurable: true });
                Object.defineProperty(proto, 'webkitHidden', { get: function () { return false; }, configurable: true });
                Object.defineProperty(proto, 'visibilityState', { get: function () { return 'visible'; }, configurable: true });
                Object.defineProperty(proto, 'webkitVisibilityState', { get: function () { return 'visible'; }, configurable: true });
                var nRaf = window.requestAnimationFrame, nCaf = window.cancelAnimationFrame;
                var stats = { fallbacks: 0 };
                Object.defineProperty(window, '__btRafStats', { value: stats });
                if (nRaf && nCaf) {
                  var seq = 0, live = {};
                  window.requestAnimationFrame = function (cb) {
                    var id = ++seq;
                    var rid = nRaf.call(window, function (t) {
                      if (!live[id]) return;
                      clearTimeout(live[id][1]);
                      delete live[id];
                      cb(t);
                    });
                    var tid = setTimeout(function () {
                      if (!live[id]) return;
                      nCaf.call(window, live[id][0]);
                      delete live[id];
                      stats.fallbacks++;
                      cb(performance.now());
                    }, 100);
                    live[id] = [rid, tid];
                    return id;
                  };
                  window.cancelAnimationFrame = function (id) {
                    var e = live[id];
                    if (!e) return;
                    delete live[id];
                    nCaf.call(window, e[0]);
                    clearTimeout(e[1]);
                  };
                }
                var block = function (e) { e.stopImmediatePropagation(); };
                window.addEventListener('visibilitychange', block, true);
                window.addEventListener('webkitvisibilitychange', block, true);
              } catch (e) {}
            })();
        """

        // Runs in the YouTube embed: reports the <video> state to the app, obeys
        // play/pause commands from the notification / lock screen, and sends
        // diagnostics for the debug log.
        private const val MEDIA_JS = """
            (function () {
              var m = location.pathname.match(/^\/embed\/([^\/?#]+)/);
              if (!m) return;
              var last = '';
              function bridge() {
                var b = window.BareTubeMedia;
                if (b && !b.onmessage) b.onmessage = function (e) {
                  var v = document.querySelector('video');
                  if (!v) return;
                  if (e.data === 'play') v.play(); else if (e.data === 'pause') v.pause();
                };
                return b;
              }
              function log(msg) {
                var b = bridge();
                if (b) b.postMessage(JSON.stringify({ type: 'log', msg: msg }));
              }
              function send(state) {
                var b = bridge();
                if (!b || state === last) return;
                last = state;
                var t = document.querySelector('.ytp-title-link');
                var title = (t && t.textContent) || document.title.replace(/ - YouTube$/, '');
                b.postMessage(JSON.stringify({ type: 'state', state: state, title: title, videoId: m[1] }));
              }
              function describe() {
                var v = document.querySelector('video');
                var vis = window.__btRealVisibility ? window.__btRealVisibility() : '?';
                if (!v) return 'no video, vis=' + vis;
                var q = v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality() : null;
                return 't=' + v.currentTime.toFixed(1) + ' paused=' + v.paused + ' rs=' + v.readyState +
                  ' ns=' + v.networkState + ' vis=' + vis +
                  ' frames=' + (q ? q.totalVideoFrames + '/' + q.droppedVideoFrames : '?') +
                  ' abytes=' + v.webkitAudioDecodedByteCount +
                  ' rafFallbacks=' + (window.__btRafStats ? window.__btRafStats.fallbacks : '?');
              }
              document.addEventListener('playing', function () { send('playing'); }, true);
              document.addEventListener('pause', function () { send('paused'); }, true);
              window.addEventListener('pagehide', function () { send('stopped'); });
              ['play', 'playing', 'pause', 'waiting', 'stalled', 'ended', 'error', 'emptied'].forEach(function (name) {
                document.addEventListener(name, function () { log('video ' + name + ': ' + describe()); }, true);
              });
              ['freeze', 'resume', 'visibilitychange'].forEach(function (name) {
                document.addEventListener(name, function () { log('page ' + name + ': ' + describe()); }, true);
              });
              ['blur', 'focus', 'pagehide', 'pageshow'].forEach(function (name) {
                window.addEventListener(name, function () { log('window ' + name + ': ' + describe()); }, true);
              });
              setInterval(function () { if (document.querySelector('video')) log('tick ' + describe()); }, 10000);
            })();
        """
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
    private var mediaPlaying = false
    private var mediaTitle = ""
    private var mediaArtwork = ""
    private lateinit var powerManager: PowerManager

    private val screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            DebugLog.log("system ${intent.action?.substringAfterLast('.')}")
        }
    }

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
        DebugLog.init(this)
        DebugLog.log("activity onCreate (restored=${savedInstanceState != null})")
        powerManager = getSystemService(PowerManager::class.java)
        ContextCompat.registerReceiver(
            this, screenReceiver,
            IntentFilter().apply {
                addAction(Intent.ACTION_SCREEN_OFF)
                addAction(Intent.ACTION_SCREEN_ON)
                addAction(Intent.ACTION_USER_PRESENT)
                addAction(AudioManager.ACTION_AUDIO_BECOMING_NOISY)
            },
            // Protected system broadcasts: only the system can send these.
            ContextCompat.RECEIVER_EXPORTED
        )

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
            DebugLog.log("notification command $cmd")
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
        // Keep the renderer process important even when the WebView is not on screen.
        webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false)
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
                if (msg.optString("type") == "log") DebugLog.log("js ${msg.optString("msg")}")
                else onMediaState(msg)
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

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                // Without this the whole app would crash. Rebuild the activity with a fresh WebView.
                DebugLog.log("renderer gone (crashed=${detail.didCrash()}, priority=${detail.rendererPriorityAtExit()})")
                PlaybackService.stop()
                root.removeView(view)
                view.destroy()
                recreate()
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
        DebugLog.log("media state $state")
        if (state == "stopped") {
            mediaPlaying = false
            PlaybackService.stop()
            return
        }
        val videoId = msg.optString("videoId")
        mediaPlaying = state == "playing"
        mediaTitle = msg.optString("title")
        mediaArtwork = if (videoId.isNotEmpty()) "https://i.ytimg.com/vi/$videoId/hqdefault.jpg" else ""
        PlaybackService.update(this, mediaPlaying, mediaTitle, "", mediaArtwork)
        if (mediaPlaying) askToIgnoreBatteryOptimizations()
    }

    private fun askToIgnoreBatteryOptimizations() {
        if (powerManager.isIgnoringBatteryOptimizations(packageName)) return
        val prefs = getSharedPreferences("baretube", MODE_PRIVATE)
        if (prefs.getBoolean("asked_battery", false)) return
        prefs.edit().putBoolean("asked_battery", true).apply()
        try {
            @SuppressLint("BatteryLife")
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName"))
            startActivity(intent)
        } catch (e: ActivityNotFoundException) {
            // Some devices don't offer this screen.
        }
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
        DebugLog.log("activity onStart")
    }

    override fun onResume() {
        super.onResume()
        DebugLog.log("activity onResume")
    }

    override fun onStop() {
        super.onStop()
        DebugLog.log("activity onStop")
    }

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        DebugLog.log("activity onTrimMemory $level")
    }

    override fun onPause() {
        super.onPause()
        DebugLog.log("activity onPause (mediaPlaying=$mediaPlaying)")
        // Deliberately not calling webView.onPause(): that would stop playback.
        CookieManager.getInstance().flush()
        // Make sure the foreground service (wake lock, wifi lock) is running before the
        // app loses the foreground, after which Android no longer allows starting it.
        if (mediaPlaying) PlaybackService.update(this, true, mediaTitle, "", mediaArtwork)
    }

    override fun onDestroy() {
        DebugLog.log("activity onDestroy")
        unregisterReceiver(screenReceiver)
        PlaybackService.commandHandler = null
        PlaybackService.stop()
        root.removeAllViews()
        webView.destroy()
        super.onDestroy()
    }
}
