package io.github.urfdvw.baretube

import android.content.Context
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Small on-device log of playback / lifecycle events, shared via the launcher shortcut. */
object DebugLog {
    private const val MAX_BYTES = 256 * 1024
    private val time = SimpleDateFormat("MM-dd HH:mm:ss.SSS", Locale.US)
    private var file: File? = null

    fun init(context: Context) {
        if (file == null) file = File(context.filesDir, "debug.log")
    }

    @Synchronized
    fun log(message: String) {
        val f = file ?: return
        try {
            if (f.length() > MAX_BYTES) {
                val text = f.readText()
                f.writeText(text.substring(text.length / 2))
            }
            f.appendText("${time.format(Date())} $message\n")
        } catch (e: Exception) {
            // Logging must never break playback.
        }
    }

    @Synchronized
    fun tail(maxChars: Int = 60_000): String {
        val text = try { file?.readText() ?: "" } catch (e: Exception) { "" }
        return if (text.length > maxChars) text.substring(text.length - maxChars) else text
    }
}
