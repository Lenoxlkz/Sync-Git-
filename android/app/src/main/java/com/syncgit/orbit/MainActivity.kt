package com.syncgit.orbit

import android.annotation.SuppressLint
import android.content.ContentValues
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.webkit.CookieManager
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import androidx.core.view.WindowCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.io.File
import java.util.concurrent.Executors

/**
 * Shell principal de Orbit para Android.
 *
 * Sirve la MISMA web que GitHub Pages (copiada en assets/site por el workflow
 * de compilación) bajo el origen seguro https://appassets.androidplatform.net,
 * con basePath /Sync-Git- intacto: paridad visual, funcional y de temas
 * (Liquid Glass, Material 3 Expressive, Modo Simple) garantizada por
 * construcción.
 *
 * Única diferencia respecto a la web: el inicio de sesión. La app usa el OAuth
 * oficial de GitHub (WebView → orbit://oauth/callback → code → token), y el
 * token se entrega a la web por sessionStorage('orbit.token'), la misma vía
 * que la web usa con el PAT, así que todo lo demás funciona exactamente igual.
 */
class MainActivity : AppCompatActivity() {

    companion object {
        const val APP_ORIGIN = "https://appassets.androidplatform.net"
        const val START_PATH = "/Sync-Git-/"
        const val SITE_ASSETS = "site"
        const val SHELL_ASSET = "shell/app-shell.js"
    }

    private lateinit var webView: WebView
    private lateinit var tokenStore: TokenStore

    @Volatile private var tokenForInjection: String? = null
    @Volatile private var shellScript: String? = null
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private val ioExecutor = Executors.newSingleThreadExecutor()

    private val assetLoader = WebViewAssetLoader.Builder()
        .setDomain("appassets.androidplatform.net")
        .addPathHandler("/Sync-Git-/", WebViewAssetLoader.AssetsPathHandler(this, SITE_ASSETS))
        .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this, SITE_ASSETS))
        .build()

    private val oauthLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode == RESULT_OK) {
                tokenForInjection = tokenStore.get()
                webView.reload()
            }
        }

    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val cb = filePathCallback
            filePathCallback = null
            cb?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        tokenStore = TokenStore(this)
        tokenForInjection = tokenStore.get()
        shellScript = readShellAsset()

        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        if (Build.VERSION.SDK_INT >= 29) {
            window.isStatusBarContrastEnforced = false
            window.isNavigationBarContrastEnforced = false
        }
        applyChrome(dark = true)

        webView = WebView(this)
        val root = FrameLayout(this)
        root.addView(
            webView,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
            ),
        )
        setContentView(root)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            textZoom = 100
        }

        webView.webViewClient = OrbitClient()
        webView.webChromeClient = OrbitChrome()
        webView.addJavascriptInterface(OrbitBridge(), "AndroidBridge")
        webView.setDownloadListener { url, _, _, _, _ ->
            if (url.startsWith("http")) openExternal(url)
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })

        CookieManager.getInstance().setAcceptCookie(true)
        webView.loadUrl(APP_ORIGIN + START_PATH)
        handleOrbitData(intent?.data)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleOrbitData(intent.data)
    }

    override fun onResume() {
        super.onResume()
        CookieManager.getInstance().flush()
    }

    override fun onPause() {
        super.onPause()
        CookieManager.getInstance().flush()
    }

    /* ---------- callback OAuth orbit://oauth/callback ---------- */

    private fun handleOrbitData(data: Uri?) {
        if (data == null) return
        if (data.scheme != "orbit") return
        val error = data.getQueryParameter("error_description")
            ?: data.getQueryParameter("error")
        val code = data.getQueryParameter("code")
        if (error != null) {
            toast("GitHub devolvió: $error", "err")
        } else if (code != null) {
            exchangeRedirectCode(code)
        }
    }

    /** Redirect recibido por intent (p. ej. si la autorización se abrió fuera). */
    private fun exchangeRedirectCode(code: String) {
        val verifier = OAuthActivity.pendingVerifier
        if (verifier == null) {
            toast("Termina el inicio de sesión desde Control Center", "info")
            return
        }
        ioExecutor.execute {
            val r = GitHubOAuth.exchangeCode(code, verifier)
            runOnUiThread {
                if (r.token != null) {
                    tokenStore.save(r.token, r.refreshToken)
                    tokenForInjection = r.token
                    OAuthActivity.pendingVerifier = null
                    OAuthActivity.pendingState = null
                    webView.reload()
                    toast("Sesión iniciada con GitHub", "ok")
                } else {
                    toast(r.errorDescription ?: "No se pudo completar el inicio de sesión", "err")
                }
            }
        }
    }

    /* ---------- cliente WebView ---------- */

    private inner class OrbitClient : WebViewClient() {
        override fun shouldInterceptRequest(
            view: WebView,
            request: WebResourceRequest,
        ): WebResourceResponse? {
            val resp = assetLoader.shouldInterceptRequest(request.url) ?: return null
            val path = request.url.path ?: return resp
            // Páginas HTML del export (rutas con "/" final o .html): inyectar
            // el shell nativo. Los .txt RSC, _next y assets se sirven tal cual.
            val isPage = path.endsWith("/") || path.endsWith(".html")
            if (isPage) return withInjectedShell(resp)
            return resp
        }

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val url = request.url
            return when {
                url.scheme == "orbit" -> {
                    handleOrbitData(url)
                    true
                }
                url.scheme == "http" || url.scheme == "https" -> {
                    if (url.host == "appassets.androidplatform.net") {
                        false
                    } else {
                        openExternal(url.toString())
                        true
                    }
                }
                else -> true
            }
        }

        override fun onPageFinished(view: WebView, url: String) {
            super.onPageFinished(view, url)
            CookieManager.getInstance().flush()
        }
    }

    private inner class OrbitChrome : WebChromeClient() {
        override fun onShowFileChooser(
            webView: WebView,
            filePathCallback: ValueCallback<Array<Uri>>,
            fileChooserParams: FileChooserParams,
        ): Boolean {
            this@MainActivity.filePathCallback?.onReceiveValue(null)
            this@MainActivity.filePathCallback = filePathCallback
            return try {
                fileChooserLauncher.launch(fileChooserParams.createIntent())
                true
            } catch (e: Exception) {
                this@MainActivity.filePathCallback = null
                false
            }
        }

        override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
            android.util.Log.d(
                "OrbitWeb",
                "${consoleMessage.messageLevel()}: ${consoleMessage.message()}",
            )
            return true
        }
    }

    /* ---------- inyección del shell + token en el HTML servido ---------- */

    private fun readShellAsset(): String? = try {
        assets.open(SHELL_ASSET).readBytes().toString(Charsets.UTF_8)
    } catch (e: Exception) {
        null
    }

    private fun withInjectedShell(resp: WebResourceResponse): WebResourceResponse {
        return try {
            val bytes = resp.data.readBytes()
            var html = String(bytes, Charsets.UTF_8)
            val tokenScript = "<script>window.__ORBIT_NATIVE_TOKEN__=" +
                (tokenForInjection?.let { JSONObject.quote(it) } ?: "null") + ";</script>"
            val shell = shellScript?.let { "<script>$it</script>" } ?: ""
            html = insertAfterHead(html, tokenScript + shell)
            val headers = HashMap<String, String>(resp.responseHeaders ?: emptyMap())
            headers["Cache-Control"] = "no-store"
            WebResourceResponse(
                "text/html", "utf-8", 200, "OK", headers,
                html.toByteArray(Charsets.UTF_8).inputStream(),
            )
        } catch (e: Exception) {
            resp
        }
    }

    private fun insertAfterHead(html: String, inject: String): String {
        val h = html.indexOf("<head", ignoreCase = true)
        if (h >= 0) {
            val end = html.indexOf('>', h)
            if (end >= 0) return html.substring(0, end + 1) + inject + html.substring(end + 1)
        }
        val b = html.indexOf("<body", ignoreCase = true)
        if (b >= 0) {
            val end = html.indexOf('>', b)
            if (end >= 0) return html.substring(0, end + 1) + inject + html.substring(end + 1)
        }
        return inject + html
    }

    /* ---------- puente JavaScript (AndroidBridge) ---------- */

    private inner class OrbitBridge {
        /** Abre el OAuth oficial de GitHub (WebView con la autorización). */
        @JavascriptInterface
        fun startOAuth() {
            runOnUiThread {
                oauthLauncher.launch(Intent(this@MainActivity, OAuthActivity::class.java))
            }
        }

        /** La web desconectó (Control Center o Borrar todo): borrar token nativo. */
        @JavascriptInterface
        fun onWebLogout() {
            runOnUiThread {
                tokenStore.clear()
                tokenForInjection = null
            }
        }

        /** La web informa el tema (dark/light) para las barras del sistema. */
        @JavascriptInterface
        fun setChrome(mode: String) {
            runOnUiThread { applyChrome(mode != "light") }
        }

        @JavascriptInterface
        fun openExternal(url: String) {
            runOnUiThread { this@MainActivity.openExternal(url) }
        }

        /** Descargas blob de la web (ZIP, archivos) → archivos reales de Android. */
        @JavascriptInterface
        fun saveFile(name: String, b64: String, mime: String) {
            ioExecutor.execute { saveFileInternal(name, b64, mime) }
        }

        @JavascriptInterface
        fun toast(msg: String, type: String) {
            runOnUiThread { this@MainActivity.toast(msg, type) }
        }
    }

    /* ---------- helpers ---------- */

    fun applyChrome(dark: Boolean) {
        val ctl = WindowCompat.getInsetsController(window, window.decorView)
        ctl.isAppearanceLightStatusBars = !dark
        ctl.isAppearanceLightNavigationBars = !dark
    }

    fun openExternal(url: String) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        } catch (e: Exception) {
            toast("No hay app para abrir este enlace", "err")
        }
    }

    fun toast(msg: String, type: String) {
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
    }

    private fun saveFileInternal(name: String, b64: String, mime: String) {
        try {
            val safe = name.ifBlank { "orbit-archivo" }.replace(Regex("[\\\\/:*?\"<>|]"), "_")
            val bytes = Base64.decode(b64, Base64.DEFAULT)
            val type = mime.ifBlank { "application/octet-stream" }
            val uri: Uri = if (Build.VERSION.SDK_INT >= 29) {
                val values = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, safe)
                    put(MediaStore.MediaColumns.MIME_TYPE, type)
                    put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Orbit")
                }
                val created = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: throw IllegalStateException("No se pudo crear el archivo")
                contentResolver.openOutputStream(created)!!.use { it.write(bytes) }
                created
            } else {
                val dir = File(getExternalFilesDir(null), "Orbit")
                dir.mkdirs()
                val f = File(dir, safe)
                f.writeBytes(bytes)
                FileProvider.getUriForFile(this, "$packageName.files", f)
            }
            runOnUiThread {
                val share = Intent(Intent.ACTION_SEND)
                    .setType(type)
                    .putExtra(Intent.EXTRA_STREAM, uri)
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                startActivity(Intent.createChooser(share, safe))
                if (Build.VERSION.SDK_INT >= 29) toast("Archivo guardado en Descargas/Orbit", "ok")
            }
        } catch (e: Exception) {
            runOnUiThread { toast("No se pudo guardar: ${e.message}", "err") }
        }
    }
}
