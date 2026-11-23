package com.syncgit.orbit

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Inicio de sesión OAuth oficial de GitHub, tal como lo describe el flujo
 * esperado: «Iniciar sesión» → WebView dentro de la app → pantalla de
 * autorización de GitHub → permisos concedidos → GitHub redirige a
 * orbit://oauth/callback → la app recibe el code y completa el login.
 *
 * Incluye como respaldo el flujo por dispositivo oficial de GitHub
 * (github.com/login/device), útil si el OAuth exige client_secret y no hay
 * uno configurado.
 */
class OAuthActivity : AppCompatActivity() {

    companion object {
        /** PKCE en curso (sobrevive recreaciones de la actividad). */
        @Volatile var pendingVerifier: String? = null
        @Volatile var pendingState: String? = null
    }

    private lateinit var store: TokenStore
    private lateinit var web: WebView
    private lateinit var status: TextView
    private lateinit var statusPanel: LinearLayout
    private lateinit var retryBtn: Button
    private lateinit var deviceFallbackBtn: Button
    private lateinit var devicePanel: LinearLayout
    private lateinit var deviceCodeView: TextView
    private lateinit var deviceStatus: TextView
    private lateinit var openInWebBtn: Button

    private val io = Executors.newSingleThreadExecutor()
    private val cancelled = AtomicBoolean(false)

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        cancelled.set(false)
        store = TokenStore(this)

        val pad = dp(16)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#06060a"))
        }

        /* cabecera */
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(pad, dp(12), pad, dp(12))
            gravity = Gravity.CENTER_VERTICAL
        }
        header.addView(TextView(this).apply {
            text = "Iniciar sesión con GitHub"
            setTextColor(Color.WHITE)
            textSize = 16f
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        })
        header.addView(TextView(this).apply {
            text = "Cancelar"
            setTextColor(Color.parseColor("#8b949e"))
            textSize = 14f
            setPadding(dp(12), dp(6), 0, dp(6))
            setOnClickListener { finish() }
        })
        root.addView(header, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

        val progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            isIndeterminate = true
        }
        root.addView(progress, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3)))

        /* panel de estado / error */
        statusPanel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, dp(10), pad, dp(10))
            visibility = View.GONE
        }
        status = TextView(this).apply {
            setTextColor(Color.parseColor("#ff938a"))
            textSize = 14f
        }
        statusPanel.addView(status, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        val errRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, dp(10), 0, 0)
        }
        retryBtn = Button(this).apply { text = "Reintentar" }
        deviceFallbackBtn = Button(this).apply { text = "Iniciar por dispositivo" }
        errRow.addView(retryBtn, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        errRow.addView(deviceFallbackBtn, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        statusPanel.addView(errRow, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        root.addView(statusPanel, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

        /* WebView de autorización */
        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
        }
        root.addView(web, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))

        /* panel del flujo por dispositivo (respaldo) */
        devicePanel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, dp(20), pad, dp(20))
            gravity = Gravity.CENTER_HORIZONTAL
            visibility = View.GONE
        }
        val deviceTitle = TextView(this).apply {
            text = "Flujo por dispositivo de GitHub"
            setTextColor(Color.WHITE)
            textSize = 18f
        }
        deviceStatus = TextView(this).apply {
            setTextColor(Color.parseColor("#c9d1d9"))
            textSize = 14f
            setPadding(0, dp(12), 0, dp(12))
        }
        deviceCodeView = TextView(this).apply {
            setTextColor(Color.WHITE)
            textSize = 30f
            gravity = Gravity.CENTER
            setPadding(dp(12), dp(16), dp(12), dp(16))
            setBackgroundColor(Color.parseColor("#161b22"))
        }
        openInWebBtn = Button(this).apply { text = "Abrir github.com/login/device" }
        devicePanel.addView(deviceTitle, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        devicePanel.addView(deviceStatus, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        devicePanel.addView(deviceCodeView, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        devicePanel.addView(openInWebBtn, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        root.addView(devicePanel, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))

        setContentView(root)

        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url
                return when {
                    u.scheme == "orbit" -> {
                        handleRedirect(u)
                        true
                    }
                    u.scheme == "http" || u.scheme == "https" -> {
                        if (u.host == "github.com") false
                        else {
                            openExternal(u.toString())
                            true
                        }
                    }
                    else -> true
                }
            }
        }

        retryBtn.setOnClickListener { startAuthorize() }
        deviceFallbackBtn.setOnClickListener { startDeviceFlow() }
        openInWebBtn.setOnClickListener {
            val s = session ?: return@setOnClickListener
            devicePanel.visibility = View.GONE
            web.visibility = View.VISIBLE
            web.loadUrl(s.verificationUri)
        }

        if (savedInstanceState == null) startAuthorize()
    }

    private var session: GitHubOAuth.DeviceSession? = null

    /* ---------- autorización web (PKCE) ---------- */

    private fun startAuthorize() {
        statusPanel.visibility = View.GONE
        devicePanel.visibility = View.GONE
        web.visibility = View.VISIBLE
        val verifier = GitHubOAuth.newVerifier()
        val state = GitHubOAuth.newState()
        pendingVerifier = verifier
        pendingState = state
        web.loadUrl(GitHubOAuth.authorizeUrl(verifier, state))
    }

    private fun handleRedirect(u: Uri) {
        val error = u.getQueryParameter("error_description") ?: u.getQueryParameter("error")
        if (error != null) {
            fail(error)
            return
        }
        val code = u.getQueryParameter("code")
        if (code == null) {
            fail("GitHub no devolvió el código de autorización")
            return
        }
        val state = u.getQueryParameter("state")
        val expected = pendingState
        if (expected != null && state != expected) {
            fail("Respuesta no solicitada por la app (state inválido)")
            return
        }
        val verifier = pendingVerifier
        if (verifier == null) {
            fail("Sesión de autorización expirada — vuelve a intentarlo")
            return
        }
        io.execute {
            val r = GitHubOAuth.exchangeCode(code, verifier)
            runOnUiThread {
                if (r.token != null) {
                    store.save(r.token, r.refreshToken)
                    pendingVerifier = null
                    pendingState = null
                    complete()
                } else {
                    val needsSecret = r.error == "incorrect_client_credentials" ||
                        (r.errorDescription ?: "").contains("secret", ignoreCase = true)
                    if (needsSecret) {
                        startDeviceFlow()
                    } else {
                        fail(r.errorDescription ?: "No se pudo completar el inicio de sesión (" + (r.error ?: "error") + ")")
                    }
                }
            }
        }
    }

    /* ---------- flujo por dispositivo (respaldo) ---------- */

    private fun startDeviceFlow() {
        statusPanel.visibility = View.GONE
        web.visibility = View.GONE
        devicePanel.visibility = View.VISIBLE
        deviceCodeView.text = "····-····"
        deviceStatus.text = "Generando código…"
        io.execute {
            try {
                val s = GitHubOAuth.deviceStart()
                session = s
                runOnUiThread {
                    deviceCodeView.text = s.userCode
                    deviceStatus.text = "Abre " + s.verificationUri + " e introduce el código. Mantén esta pantalla abierta hasta que la app confirme."
                }
                pollDevice(s.deviceCode, s.intervalSec * 1000L)
            } catch (e: Exception) {
                runOnUiThread {
                    deviceStatus.text = "No se pudo iniciar el flujo por dispositivo: ${e.message}"
                }
            }
        }
    }

    private fun pollDevice(deviceCode: String, startIntervalMs: Long) {
        io.execute {
            var interval = startIntervalMs
            val deadline = System.currentTimeMillis() + 15 * 60 * 1000L
            while (!cancelled.get() && System.currentTimeMillis() < deadline) {
                try {
                    Thread.sleep(interval)
                } catch (e: InterruptedException) {
                    return@execute
                }
                if (cancelled.get()) return@execute
                val r = GitHubOAuth.devicePoll(deviceCode)
                when {
                    r.token != null -> {
                        store.save(r.token, r.refreshToken)
                        runOnUiThread { complete() }
                        return@execute
                    }
                    r.error == "authorization_pending" -> Unit
                    r.error == "slow_down" -> interval += 5000L
                    else -> {
                        runOnUiThread {
                            deviceStatus.text = "GitHub: " + (r.errorDescription ?: r.error ?: "error")
                        }
                        return@execute
                    }
                }
            }
        }
    }

    /* ---------- estado ---------- */

    private fun complete() {
        setResult(RESULT_OK)
        finish()
    }

    private fun fail(msg: String) {
        web.visibility = View.GONE
        devicePanel.visibility = View.GONE
        statusPanel.visibility = View.VISIBLE
        status.text = msg
    }

    private fun openExternal(url: String) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        } catch (e: Exception) {
            statusPanel.visibility = View.VISIBLE
            status.text = "No hay app para abrir este enlace"
        }
    }

    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

    override fun onDestroy() {
        cancelled.set(true)
        io.shutdownNow()
        super.onDestroy()
    }
}
