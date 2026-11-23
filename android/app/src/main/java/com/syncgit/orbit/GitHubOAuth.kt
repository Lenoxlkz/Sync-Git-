package com.syncgit.orbit

import android.os.Build
import android.util.Base64
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.MessageDigest
import java.security.SecureRandom

/**
 * OAuth oficial de GitHub para Orbit (flujo web application + PKCE S256).
 *
 * 1. Autorización: https://github.com/login/oauth/authorize con client_id,
 *    redirect_uri=orbit://oauth/callback, TODOS los scopes, state y PKCE.
 * 2. GitHub redirige a la app con ?code=… (interceptado en el WebView o por
 *    el intent-filter orbit://oauth/callback).
 * 3. Intercambio: POST /login/oauth/access_token con code_verifier (PKCE).
 *    GitHub soporta PKCE desde julio 2025 para OAuth Apps y GitHub Apps.
 *    Si el OAuth es una OAuth App clásica que exige client_secret y hay uno
 *    configurado (BuildConfig desde el secret GITHUB_CLIENT_SECRET), se reintenta.
 * 4. Respaldo: flujo por dispositivo (/login/device/code), que funciona con
 *    client_id y ofrece los mismos scopes.
 */
object GitHubOAuth {

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

    fun authorizeUrl(verifier: String, state: String): String {
        return AUTH_URL +
            "?client_id=" + enc(BuildConfig.GITHUB_CLIENT_ID) +
            "&redirect_uri=" + enc(BuildConfig.GITHUB_REDIRECT_URI) +
            "&scope=" + enc(BuildConfig.GITHUB_SCOPES) +
            "&state=" + enc(state) +
            "&code_challenge=" + enc(s256(verifier)) +
            "&code_challenge_method=S256"
    }

    /* ---------- intercambio code → token ---------- */

    fun exchangeCode(code: String, verifier: String): ExchangeResult {
        // 1) PKCE sin client secret (GitHub Apps / OAuth con PKCE)
        var r = exchangeOnce(code, verifier, null)
        if (r.token != null) return r
        // 2) Reintento con client secret si está configurado (OAuth App clásica)
        val needsSecret = r.error == "incorrect_client_credentials" ||
            (r.errorDescription ?: "").contains("secret", ignoreCase = true)
        if (needsSecret && BuildConfig.GITHUB_CLIENT_SECRET.isNotBlank()) {
            val r2 = exchangeOnce(code, verifier, BuildConfig.GITHUB_CLIENT_SECRET)
            if (r2.token != null) return r2
            return r2
        }
        return r
    }

    private fun exchangeOnce(code: String, verifier: String, secret: String?): ExchangeResult {
        val body = JSONObject()
            .put("client_id", BuildConfig.GITHUB_CLIENT_ID)
            .put("code", code)
            .put("redirect_uri", BuildConfig.GITHUB_REDIRECT_URI)
            .put("code_verifier", verifier)
        if (secret != null) body.put("client_secret", secret)
        val (http, json) = postJson(TOKEN_URL, body)
        val token = json.optString("access_token", "")
        if (token.isNotBlank()) {
            return ExchangeResult(token, json.optString("refresh_token", "").ifBlank { null }, null, null)
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
            return PollResult(token, json.optString("refresh_token", "").ifBlank { null }, null, null)
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
