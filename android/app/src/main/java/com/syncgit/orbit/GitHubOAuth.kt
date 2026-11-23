package com.syncgit.orbit

import android.util.Base64
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.MessageDigest
import java.security.SecureRandom

/**
 * OAuth oficial de GitHub para Orbit, con selector de cuentas — el mismo
 * patrón que usan las apps nativas con callback por deep link (GitSync, etc.):
 *
 *  1. La WebView dentro de la app abre la pantalla OFICIAL de selección de
 *     cuenta de GitHub:
 *       https://github.com/login/oauth/select_account
 *         ?client_id=…&redirect_uri=orbit%3A%2F%2Foauth%2Fcallback
 *         &response_type=code&scope=…&state=…&code_challenge=…
 *         &code_challenge_method=S256
 *  2. GitHub muestra de una vez las cuentas con sesión activa («Signed in as
 *     … → Continue») o «Use a different account»; si la WebView no tiene
 *     sesión, primero pide login y regresa al selector. VERIFICADO contra el
 *     endpoint real: responde 302 a /login conservando el return_to con TODOS
 *     los parámetros cuando no hay sesión.
 *  3. Al elegir cuenta, GitHub redirige a orbit://oauth/callback?code=…
 *     (interceptado por la WebView o por el intent-filter) y la app intercambia
 *     el code por el token (PKCE S256 incluido como blindaje).
 *
 * VERIFICADO contra el endpoint real de intercambio (POST
 * /login/oauth/access_token) con client_id reales y códigos en varios
 * formatos: GitHub exige client_secret para TODAS las OAuth Apps — con o sin
 * PKCE, sin él responde incorrect_client_credentials antes de mirar el code.
 * Por eso el secret viaja embebido desde Actions (GITHUB_CLIENT_SECRET) o la
 * app lo pide UNA vez y lo guarda cifrado (TokenStore).
 *
 * Respaldo: device flow oficial de GitHub (funciona solo con client_id,
 * sin secret) vía github.com/login/device.
 */
object GitHubOAuth {

    /** Pantalla oficial de selección de cuenta de GitHub. */
    private const val SELECT_ACCOUNT_URL = "https://github.com/login/oauth/select_account"
    private const val AUTH_URL = "https://github.com/login/oauth/authorize"
    private const val TOKEN_URL = "https://github.com/login/oauth/access_token"
    private const val DEVICE_URL = "https://github.com/login/device/code"

    class ExchangeResult(
        val token: String?,
        val refreshToken: String?,
        val error: String?,
        val errorDescription: String?,
    )

    class DeviceSession(
        val deviceCode: String,
        val userCode: String,
        val verificationUri: String,
        val intervalSec: Int,
        val expiresSec: Int,
    )

    class PollResult(
        val token: String?,
        val refreshToken: String?,
        val error: String?,
        val errorDescription: String?,
    )

    /* ---------- PKCE ---------- */

    fun newVerifier(): String {
        val bytes = ByteArray(64)
        SecureRandom().nextBytes(bytes)
        return Base64.encodeToString(bytes, Base64.NO_PADDING or Base64.NO_WRAP or Base64.URL_SAFE)
    }

    fun newState(): String = newVerifier().substring(0, 24)

    fun s256(verifier: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(verifier.toByteArray(Charsets.US_ASCII))
        return Base64.encodeToString(digest, Base64.NO_PADDING or Base64.NO_WRAP or Base64.URL_SAFE)
    }

    /* ---------- URLs de autorización (cadena de respaldo) ---------- */

    /** 1. Selector de cuentas: lo primero que ve el usuario (patrón GitSync). */
    fun selectAccountUrl(verifier: String, state: String): String =
        buildAuthorizeUrl(SELECT_ACCOUNT_URL, verifier, state, null)

    /** 2. Autorización clásica con prompt=select_account (mismo selector). */
    fun authorizeWithPromptUrl(verifier: String, state: String): String =
        buildAuthorizeUrl(AUTH_URL, verifier, state, "prompt=select_account")

    /** 3. Autorización clásica (respaldo final). */
    fun classicAuthorizeUrl(verifier: String, state: String): String =
        buildAuthorizeUrl(AUTH_URL, verifier, state, null)

    /** Las tres variantes, por si GitHub retirara alguna ruta. */
    fun authorizeUrls(verifier: String, state: String): List<String> = listOf(
        selectAccountUrl(verifier, state),
        authorizeWithPromptUrl(verifier, state),
        classicAuthorizeUrl(verifier, state),
    )

    private fun buildAuthorizeUrl(
        base: String,
        verifier: String,
        state: String,
        extra: String?,
    ): String {
        var url = base +
            "?client_id=" + enc(BuildConfig.GITHUB_CLIENT_ID) +
            "&redirect_uri=" + enc(BuildConfig.GITHUB_REDIRECT_URI) +
            "&response_type=code" +
            "&scope=" + enc(BuildConfig.GITHUB_SCOPES) +
            "&state=" + enc(state) +
            "&code_challenge=" + enc(s256(verifier)) +
            "&code_challenge_method=S256"
        if (!extra.isNullOrBlank()) url += "&" + extra
        return url
    }

    /* ---------- intercambio code → token ---------- */

    /**
     * Intercambia el code por el token. El client_secret es imprescindible
     * (verificado contra GitHub: sin él responde incorrect_client_credentials
     * con o sin PKCE); PKCE S256 va siempre; el redirect_uri debe ser
     * EXACTAMENTE el mismo que en la autorización.
     */
    fun exchangeCode(code: String, verifier: String, clientSecret: String?): ExchangeResult {
        if (clientSecret.isNullOrBlank()) {
            return ExchangeResult(
                null,
                null,
                "missing_client_secret",
                "GitHub exige el client_secret de la OAuth App para completar el inicio de " +
                    "sesión web (verificado: sin él responde incorrect_client_credentials).",
            )
        }
        val body = JSONObject()
            .put("client_id", BuildConfig.GITHUB_CLIENT_ID)
            .put("client_secret", clientSecret)
            .put("code", code)
            .put("redirect_uri", BuildConfig.GITHUB_REDIRECT_URI)
            .put("code_verifier", verifier)
        val (http, json) = postJson(TOKEN_URL, body)
        val token = json.optString("access_token", "")
        if (token.isNotBlank()) {
            return ExchangeResult(
                token,
                json.optString("refresh_token", "").ifBlank { null },
                null,
                null,
            )
        }
        val error = json.optString("error", "").ifBlank { "error" }
        val desc = json.optString("error_description", "").ifBlank {
            if (http >= 400) "GitHub respondió HTTP $http" else null
        }
        return ExchangeResult(null, null, error, desc)
    }

    /* ---------- flujo por dispositivo (respaldo) ---------- */

    fun deviceStart(): DeviceSession {
        val body = JSONObject()
            .put("client_id", BuildConfig.GITHUB_CLIENT_ID)
            .put("scope", BuildConfig.GITHUB_SCOPES)
        val (http, json) = postJson(DEVICE_URL, body)
        if (http != 200) {
            val desc = json.optString("error_description", "")
            throw IllegalStateException(
                "GitHub respondió HTTP $http" + (if (desc.isNotBlank()) ": $desc" else ""),
            )
        }
        return DeviceSession(
            json.getString("device_code"),
            json.getString("user_code"),
            json.optString("verification_uri", "https://github.com/login/device"),
            json.optInt("interval", 5),
            json.optInt("expires_in", 900),
        )
    }

    fun devicePoll(deviceCode: String): PollResult {
        val body = JSONObject()
            .put("client_id", BuildConfig.GITHUB_CLIENT_ID)
            .put("device_code", deviceCode)
            .put("grant_type", "urn:ietf:params:oauth:grant-type:device_code")
        val (http, json) = postJson(TOKEN_URL, body)
        val token = json.optString("access_token", "")
        if (token.isNotBlank()) {
            return PollResult(
                token,
                json.optString("refresh_token", "").ifBlank { null },
                null,
                null,
            )
        }
        val error = json.optString("error", "").ifBlank { "error" }
        val desc = json.optString("error_description", "").ifBlank {
            if (http >= 400) "GitHub respondió HTTP $http" else null
        }
        return PollResult(null, null, error, desc)
    }

    /* ---------- HTTP ---------- */

    private fun enc(s: String): String = URLEncoder.encode(s, "UTF-8")

    private fun postJson(url: String, body: JSONObject): Pair<Int, JSONObject> {
        val conn = URL(url).openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "POST"
            conn.doOutput = true
            conn.connectTimeout = 15000
            conn.readTimeout = 25000
            conn.setRequestProperty("Accept", "application/json")
            conn.setRequestProperty("Content-Type", "application/json")
            conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val status = conn.responseCode
            val stream = if (status in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.readBytes()?.toString(Charsets.UTF_8) ?: ""
            val json = if (text.isBlank()) JSONObject() else JSONObject(text)
            return Pair(status, json)
        } finally {
            conn.disconnect()
        }
    }
}
