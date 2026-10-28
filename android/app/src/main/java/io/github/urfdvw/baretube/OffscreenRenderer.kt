package io.github.urfdvw.baretube

import android.graphics.HardwareRenderer
import android.graphics.PixelFormat
import android.graphics.RenderNode
import android.hardware.HardwareBuffer
import android.media.ImageReader
import android.os.Handler
import android.os.Looper
import android.view.View
import androidx.annotation.RequiresApi

/**
 * Draws a view into an invisible GPU surface at a steady rate. Used while the
 * app is in the background (screen on or off): the activity window no longer
 * draws, but the WebView only hands decoded video frames on (and so keeps
 * playing) when it is drawn.
 */
@RequiresApi(29)
class OffscreenRenderer(private val view: View) {
    private companion object {
        const val FRAME_MS = 33L
    }

    private val handler = Handler(Looper.getMainLooper())
    private val node = RenderNode("BareTubeOffscreen")
    private var renderer: HardwareRenderer? = null
    private var reader: ImageReader? = null
    private var running = false
    private var frames = 0

    private val frame = object : Runnable {
        override fun run() {
            if (!running) return
            drawOnce()
            handler.postDelayed(this, FRAME_MS)
        }
    }

    fun start() {
        if (running) return
        running = true
        frames = 0
        DebugLog.log("offscreen rendering started")
        handler.post(frame)
    }

    fun stop() {
        if (!running) return
        running = false
        handler.removeCallbacks(frame)
        renderer?.destroy()
        renderer = null
        reader?.close()
        reader = null
        DebugLog.log("offscreen rendering stopped after $frames frames")
    }

    private fun drawOnce() {
        val w = view.width
        val h = view.height
        if (w == 0 || h == 0) return
        try {
            val current = reader
            if (renderer == null || current == null || current.width != w || current.height != h) {
                renderer?.destroy()
                current?.close()
                val newReader = ImageReader.newInstance(
                    w, h, PixelFormat.RGBA_8888, 3,
                    HardwareBuffer.USAGE_GPU_COLOR_OUTPUT or HardwareBuffer.USAGE_GPU_SAMPLED_IMAGE
                )
                // Nobody looks at the result; just free the buffers.
                newReader.setOnImageAvailableListener({ it.acquireLatestImage()?.close() }, handler)
                reader = newReader
                renderer = HardwareRenderer().apply {
                    setSurface(newReader.surface)
                    setContentRoot(node)
                    start()
                }
            }
            node.setPosition(0, 0, w, h)
            val canvas = node.beginRecording(w, h)
            try {
                view.draw(canvas)
            } finally {
                node.endRecording()
            }
            renderer!!.createRenderRequest().setWaitForPresent(false).syncAndDraw()
            if (++frames % 300 == 0) DebugLog.log("offscreen frames $frames")
        } catch (e: Exception) {
            DebugLog.log("offscreen draw failed: $e")
            stop()
        }
    }
}
