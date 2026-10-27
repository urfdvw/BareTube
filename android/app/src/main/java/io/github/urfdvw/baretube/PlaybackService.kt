package io.github.urfdvw.baretube

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import java.net.URL
import kotlin.concurrent.thread

/**
 * Foreground service that keeps the process alive while a video is open,
 * holds wake/wifi locks while it plays, and shows the media notification
 * with lock-screen controls.
 */
class PlaybackService : Service() {

    companion object {
        private const val CHANNEL_ID = "playback"
        private const val NOTIFICATION_ID = 1
        private const val ACTION_UPDATE = "update"
        private const val ACTION_PLAY = "play"
        private const val ACTION_PAUSE = "pause"
        private const val ACTION_CLOSE = "close"
        private const val EXTRA_PLAYING = "playing"
        private const val EXTRA_TITLE = "title"
        private const val EXTRA_ARTIST = "artist"
        private const val EXTRA_ARTWORK = "artwork"

        /** Receives "play" / "pause" commands from the notification. Set by MainActivity. */
        var commandHandler: ((String) -> Unit)? = null

        private var instance: PlaybackService? = null

        fun update(context: Context, playing: Boolean, title: String, artist: String, artwork: String) {
            val running = instance
            if (running != null) {
                running.applyState(playing, title, artist, artwork)
                return
            }
            if (!playing) return
            val intent = Intent(context, PlaybackService::class.java)
                .setAction(ACTION_UPDATE)
                .putExtra(EXTRA_PLAYING, true)
                .putExtra(EXTRA_TITLE, title)
                .putExtra(EXTRA_ARTIST, artist)
                .putExtra(EXTRA_ARTWORK, artwork)
            try {
                ContextCompat.startForegroundService(context, intent)
            } catch (e: Exception) {
                // Starting from the background is not allowed on Android 12+; nothing to do.
            }
        }

        fun stop() {
            instance?.stopPlayback()
        }
    }

    private lateinit var session: MediaSessionCompat
    private lateinit var wakeLock: PowerManager.WakeLock
    private lateinit var wifiLock: WifiManager.WifiLock
    private val mainHandler = Handler(Looper.getMainLooper())
    private val releaseLocksRunnable = Runnable { releaseLocks() }

    private var playing = false
    private var title = ""
    private var artist = ""
    private var artworkUrl = ""
    private var artwork: Bitmap? = null

    override fun onCreate() {
        super.onCreate()
        instance = this

        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, getString(R.string.channel_playback), NotificationManager.IMPORTANCE_LOW)
        )

        wakeLock = getSystemService(PowerManager::class.java)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "BareTube:playback")
        @Suppress("DEPRECATION")
        wifiLock = (applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager)
            .createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "BareTube:playback")

        session = MediaSessionCompat(this, "BareTube").apply {
            setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlay() { commandHandler?.invoke("play") }
                override fun onPause() { commandHandler?.invoke("pause") }
            })
            setSessionActivity(openAppIntent())
            isActive = true
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_UPDATE -> {
                // Must enter the foreground right away after startForegroundService().
                title = intent.getStringExtra(EXTRA_TITLE) ?: ""
                artist = intent.getStringExtra(EXTRA_ARTIST) ?: ""
                playing = intent.getBooleanExtra(EXTRA_PLAYING, false)
                enterForeground()
                applyState(playing, title, artist, intent.getStringExtra(EXTRA_ARTWORK) ?: "")
            }
            ACTION_PLAY -> commandHandler?.invoke("play")
            ACTION_PAUSE -> commandHandler?.invoke("pause")
            ACTION_CLOSE -> {
                commandHandler?.invoke("pause")
                stopPlayback()
            }
            else -> if (!playing) stopSelf()
        }
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        instance = null
        mainHandler.removeCallbacksAndMessages(null)
        releaseLocks()
        session.release()
        super.onDestroy()
    }

    private fun applyState(playing: Boolean, title: String, artist: String, artwork: String) {
        this.playing = playing
        if (title.isNotEmpty()) this.title = title
        if (artist.isNotEmpty()) this.artist = artist
        if (artwork.isNotEmpty() && artwork != artworkUrl) {
            artworkUrl = artwork
            this.artwork = null
            loadArtwork(artwork)
        }

        // Hold the locks a little after a pause so a system-caused pause can be undone
        // before the CPU goes to sleep.
        mainHandler.removeCallbacks(releaseLocksRunnable)
        if (playing) acquireLocks() else mainHandler.postDelayed(releaseLocksRunnable, 10_000)

        session.setMetadata(
            MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, this.title)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, this.artist)
                .putBitmap(MediaMetadataCompat.METADATA_KEY_ART, this.artwork)
                .build()
        )
        session.setPlaybackState(
            PlaybackStateCompat.Builder()
                .setActions(PlaybackStateCompat.ACTION_PLAY or PlaybackStateCompat.ACTION_PAUSE or PlaybackStateCompat.ACTION_PLAY_PAUSE)
                .setState(
                    if (playing) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED,
                    PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN,
                    1f
                )
                .build()
        )
        enterForeground()
    }

    private fun stopPlayback() {
        releaseLocks()
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun enterForeground() {
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK else 0
        ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(), type)
    }

    private fun buildNotification(): Notification {
        val toggle = if (playing) {
            NotificationCompat.Action(R.drawable.ic_pause, getString(R.string.pause), serviceIntent(ACTION_PAUSE))
        } else {
            NotificationCompat.Action(R.drawable.ic_play, getString(R.string.play), serviceIntent(ACTION_PLAY))
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title.ifEmpty { getString(R.string.app_name) })
            .setContentText(artist)
            .setLargeIcon(artwork)
            .setContentIntent(openAppIntent())
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setOngoing(playing)
            .addAction(toggle)
            .addAction(R.drawable.ic_close, getString(R.string.close), serviceIntent(ACTION_CLOSE))
            .setStyle(
                androidx.media.app.NotificationCompat.MediaStyle()
                    .setMediaSession(session.sessionToken)
                    .setShowActionsInCompactView(0)
            )
            .build()
    }

    private fun serviceIntent(action: String): PendingIntent =
        PendingIntent.getService(
            this, action.hashCode(),
            Intent(this, PlaybackService::class.java).setAction(action),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

    private fun openAppIntent(): PendingIntent =
        PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

    private fun loadArtwork(url: String) {
        thread {
            val bitmap = try {
                URL(url).openStream().use { BitmapFactory.decodeStream(it) }
            } catch (e: Exception) {
                null
            }
            mainHandler.post {
                if (instance === this && url == artworkUrl && bitmap != null) {
                    artwork = bitmap
                    applyState(playing, title, artist, url)
                }
            }
        }
    }

    private fun acquireLocks() {
        if (!wakeLock.isHeld) wakeLock.acquire()
        if (!wifiLock.isHeld) wifiLock.acquire()
    }

    private fun releaseLocks() {
        if (wakeLock.isHeld) wakeLock.release()
        if (wifiLock.isHeld) wifiLock.release()
    }
}
