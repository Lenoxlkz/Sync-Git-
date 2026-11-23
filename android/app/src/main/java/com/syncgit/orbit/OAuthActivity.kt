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
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Inicio de sesión OAuth oficial de GitHub con selector de cuentas.
 *
 * Flujo (el estándar de las apps nativas con callback por deep link):
 *  1. «Iniciar sesión» → WebView dentro de la app.
 *  2. GitHub muestra DE UNA VEZ la pantalla oficial de selección de cuenta:
 *     las cuentas con sesión activa («Signed in as … → Continue») o «Use a
 *     different account»; si la WebView aún no tiene sesión, primero el login
 *     y después el selector. El Client ID de la OAuth de Orbit va en la URL
 *     junto a state, PKCE S256 y la callback registrada orbit://oauth/callback.
 *  3. Al elegir cuenta, GitHub redirige a orbit://oauth/callback?code=…, la
 *     app intercambia el code por el token y cierra.
 *
 * El intercambio exige el client_secret de la OAuth App (verificado contra el
 * endpoint real: GitHub lo rechaza sin él, con o sin PKCE). La primera vez que
 * se inicia sesión la app lo pide en una pantalla propia con el enlace directo
 * a github.com/settings/developers, lo guarda CIFRADO y no vuelve a preguntar.
 * Si el workflow lo entrega embebido (secret GITHUB_CLIENT_SECRET en Actions)
 * ni siquiera aparece esa pantalla. El device flow oficial de GitHub queda
 * como respaldo, nunca como camino principal.
 */
class OAuthActivity : AppCompatActivity() {

    companion object {
        /** PKCE en curso (sobrevive recreaciones de la actividad). */
        @Volatile var pendingVerifier: String? = null
        @Volatile var pendingState: String? = null

        private const val OAUTH_SETTINGS_URL = "https://github.com/settings/developers"
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
    private lateinit var copyCodeBtn: Button
    private lateinit var secretPanel: ScrollView
    private lateinit var secretStatus: TextView
    private lateinit var secretInput: EditText
    private lateinit var secretSaveBtn: Button
    private lateinit var secretOpenSettingsBtn: Button
    private lateinit var secretDeviceBtn: Button

    private val io = Executors.newSingleThreadExecutor()
    private val cancelled = AtomicBoolean(false)

    /** Cadena de respaldo de URLs de autorización (select_account → prompt). */
    private var authorizeVariants: List<String> = emptyList()
    private var variantIndex = 0

    private var session: GitHubOAuth.DeviceSession? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        cancelled.set(false)
        store = TokenStore(this)
        CookieManager.getInstance().setAcceptCookie(true)

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
        root.addView(
            header,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ),
        )

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
        statusPanel.addView(
            status,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ),
        )
        val errRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, dp(10), 0, 0)
        }
        retryBtn = Button(this).apply { text = "Reintentar" }
        deviceFallbackBtn = Button(this).apply { text = "Iniciar por dispositivo" }
        errRow.addView(
            retryBtn,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ),
        )
        errRow.addView(
            deviceFallbackBtn,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ),
        )
        statusPanel.addView(
            errRow,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ),
        )
        root.addView(
            statusPanel,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ),
        )

        /* WebView de autorización */
        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            /* Presentarse como Chrome normal (sin «; wv»): GitHub acomoda mejor
               el login y el selector de cuentas que en un WebView genérico. */
            settings.userAgentString = settings.userAgentString.replace("; wv)", ")")
        }
        root.addView(web, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))

        /* panel del client_secret (una sola vez, scrollable por si la pantalla
           es pequeña) */
        secretPanel = ScrollView(this).apply {
            visibility = View.GONE
            setBackgroundColor(Color.parseColor("#06060a"))
        }
        val secretInner = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, dp(24), pad, dp(24))
        }
        secretInner.addView(TextView(this).apply {
            text = "Conectar el client_secret"
            setTextColor(Color.WHITE)
            textSize = 19f
        })
        secretStatus = TextView(this).apply {
            setTextColor(Color.parseColor("#ff938a"))
            textSize = 13f
            setPadding(0, dp(8), 0, 0)
            visibility = View.GONE
        }
        secretInner.addView(
            secretStatus,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ),
        )
        secretInner.addView(TextView(this).apply {
            setTextColor(Color.parseColor("#c9d1d9"))
            textSize = 13f
            setPadding(0, dp(10), 0, dp(10))
            text = "Para completar el inicio de sesión con el selector de cuentas, GitHub " +
                "exige el client_secret de tu OAuth App (el Client ID solo basta para el " +
                "flujo por dispositivo). Genera uno en github.com/settings/developers → " +
                "«Git Orbit» → «Generate a new client secret», pégalo aquí y no se volverá " +
                "a pedir: queda cifrado en el dispositivo. Si el build lo trae embebido " +
                "(secret GITHUB_CLIENT_SECRET en Actions), esta pantalla nunca aparece."
        })
        secretInput = EditText(this).apply {
            hint = "Pega aquí el client_secret"
            setSingleLine(true)
            setTextColor(Color.WHITE)
            setHintTextColor(Color.parseColor("#8b949e"))
            setBackgroundColor(Color.parseColor("#161b22"))
            setPadding(dp(12), dp(12), dp(12), dp(12))
        }
        secretInner.addView(
            secretInput,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ),
        )
        secretSaveBtn = Button(this).apply { text = "Guardar y continuar" }
        secretInner.addView(
            secretSaveBtn,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ),
        )
        secretOpenSettingsBtn = Button(this).apply { text = "Abrir github.com/settings/developers" }
        secretInner.addView(
            secretOpenSettingsBtn,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ),
        )
        secretDeviceBtn = Button(this).apply { text = "Prefiero el flujo por dispositivo" }
        secretInner.addView(
            secretDeviceBtn,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ),
        )
        secretPanel.addView(
            secretInner,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ),
        )
        root.addView(secretPanel, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))

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
        copyCodeBtn = Button(this).apply {
            text = "Copiar código"
            setOnClickListener {
                val code = deviceCodeView.text.toString()
                if (code.isNotBlank() && code != "····-····") {
                    val cm = getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                    cm.setPrimaryClip(android.content.ClipData.newPlainText("Orbit", code))
                    deviceStatus.text = "Código copiado al portapapeles ✓"
                }
            }
        }
        devicePanel.addView(
            deviceTitle,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ),
        )
        devicePanel.addView(
            deviceStatus,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ),
        )
        devicePanel.addView(
            deviceCodeView,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ),
        )
        val deviceBtnRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(0, dp(12), 0, 0)
        }
        deviceBtnRow.addView(
            copyCodeBtn,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ).apply { rightMargin = dp(12) },
        )
        deviceBtnRow.addView(
            openInWebBtn,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ),
        )
        devicePanel.addView(
            deviceBtnRow,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ),
        )
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

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                maybeAdvanceVariant(request)
            }

            override fun onReceivedHttpError(
                view: WebView,
                request: WebResourceRequest,
                errorResponse: WebResourceResponse,
            ) {
                maybeAdvanceVariant(request)
            }
        }

        retryBtn.setOnClickListener { startPreferredFlow() }
        deviceFallbackBtn.setOnClickListener { startDeviceFlow() }
        openInWebBtn.setOnClickListener {
            val s = session ?: return@setOnClickListener
            devicePanel.visibility = View.GONE
            web.visibility = View.VISIBLE
            web.loadUrl(s.verificationUri)
        }
        secretSaveBtn.setOnClickListener { saveSecretAndContinue() }
        secretOpenSettingsBtn.setOnClickListener { openExternal(OAUTH_SETTINGS_URL) }
        secretDeviceBtn.setOnClickListener { startDeviceFlow() }

        if (savedInstanceState == null) startPreferredFlow()
    }

    /* ---------- selección de flujo ---------- */

    /** Secret vigente: el guardado cifrado en el dispositivo o el embebido
     *  en el build (secret GITHUB_CLIENT_SECRET en Actions). */
    private fun currentSecret(): String? =
        store.getSecret()?.takeIf { it.isNotBlank() }
            ?: BuildConfig.GITHUB_CLIENT_SECRET.takeIf { it.isNotBlank() }

    private fun startPreferredFlow() {
        if (currentSecret() != null) startAuthorize() else showSecretPanel(null)
    }

    private fun showSecretPanel(message: String?) {
        statusPanel.visibility = View.GONE
        devicePanel.visibility = View.GONE
        web.visibility = View.GONE
        secretPanel.visibility = View.VISIBLE
        if (message.isNullOrBlank()) {
            secretStatus.visibility = View.GONE
            secretStatus.text = ""
        } else {
            secretStatus.visibility = View.VISIBLE
            secretStatus.text = message
        }
    }

    private fun saveSecretAndContinue() {
        val s = secretInput.text.toString().trim()
        if (s.length < 20) {
            secretStatus.visibility = View.VISIBLE
            secretStatus.text =
                "Eso no parece un client_secret: se genera con «Generate a new client " +
                    "secret» en la página de la OAuth App (no es el Client ID ni un token ghp_…)."
            return
        }
        store.saveSecret(s)
        startAuthorize()
    }

    /* ---------- autorización web con selector de cuentas ---------- */

    private fun startAuthorize() {
        statusPanel.visibility = View.GONE
        devicePanel.visibility = View.GONE
        secretPanel.visibility = View.GONE
        web.visibility = View.VISIBLE
        val verifier = GitHubOAuth.newVerifier()
        val state = GitHubOAuth.newState()
        pendingVerifier = verifier
        pendingState = state
        authorizeVariants = GitHubOAuth.authorizeUrls(verifier, state)
        variantIndex = 0
        web.loadUrl(authorizeVariants[0])
    }

    /** Si GitHub no pudiera servir una variante de la URL de autorización,
     *  prueba la siguiente en silencio (select_account → prompt → clásica). */
    private fun maybeAdvanceVariant(request: WebResourceRequest) {
        if (!request.isForMainFrame) return
        if (authorizeVariants.isEmpty()) return
        val failed = request.url.toString()
        if (failed != authorizeVariants.getOrNull(variantIndex)) return
        if (variantIndex < authorizeVariants.size - 1) {
            variantIndex++
            web.loadUrl(authorizeVariants[variantIndex])
        } else {
            fail("GitHub no pudo cargar la pantalla de autorización. Revisa tu conexión y reintenta.")
        }
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
            val r = GitHubOAuth.exchangeCode(code, verifier, currentSecret())
            runOnUiThread {
                if (r.token != null) {
                    store.save(r.token, r.refreshToken)
                    pendingVerifier = null
                    pendingState = null
                    complete()
                } else when (r.error) {
                    "missing_client_secret", "incorrect_client_credentials" ->
                        showSecretPanel(secretPanelMessage(r.error ?: ""))
                    else ->
                        fail(
                            r.errorDescription ?: "No se pudo completar el inicio de sesión (" +
                                (r.error ?: "error") + ")",
                        )
                }
            }
        }
    }

    private fun secretPanelMessage(error: String): String =
        if (error == "incorrect_client_credentials") {
            "GitHub rechazó el client_secret guardado. Genera uno nuevo en " +
                "github.com/settings/developers → «Git Orbit» → «Generate a new client " +
                "secret» y pégalo aquí (el Client ID no sirve; el secret se genera aparte)."
        } else {
            "Para completar el inicio de sesión con el selector de cuentas, GitHub exige " +
                "el client_secret de tu OAuth App. Genera uno en github.com/settings/" +
                "developers → «Git Orbit» → «Generate a new client secret», pégalo aquí " +
                "y no se volverá a pedir."
        }

    /* ---------- flujo por dispositivo (respaldo) ---------- */

    private fun startDeviceFlow() {
        statusPanel.visibility = View.GONE
        secretPanel.visibility = View.GONE
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
                    deviceStatus.text =
                        "Abre " + s.verificationUri + " e introduce el código. Mantén esta " +
                            "pantalla abierta hasta que la app confirme."
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
        secretPanel.visibility = View.GONE
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

    override fun onPause() {
        super.onPause()
        CookieManager.getInstance().flush()
    }

    override fun onResume() {
        super.onResume()
        CookieManager.getInstance().flush()
    }

    override fun onDestroy() {
        cancelled.set(true)
        io.shutdownNow()
        super.onDestroy()
    }
}
