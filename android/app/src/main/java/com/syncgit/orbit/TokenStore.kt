package com.syncgit.orbit

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Almacén nativo del token OAuth y del client_secret de la OAuth App. Se
 * guarda cifrado con AES-256-GCM en Keystore (EncryptedSharedPreferences);
 * si el Keystore del dispositivo falla, cae a SharedPreferences privadas de
 * la app (sin exportar).
 */
class TokenStore(context: Context) {

    private val prefs: SharedPreferences = try {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "orbit_secure_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    } catch (t: Throwable) {
        context.getSharedPreferences("orbit_prefs", Context.MODE_PRIVATE)
    }

    fun save(token: String, refreshToken: String? = null) {
        prefs.edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_REFRESH, refreshToken)
            .putBoolean(KEY_LOGGED_OUT, false)
            .apply()
    }

    fun get(): String? = prefs.getString(KEY_TOKEN, null)

    fun getRefresh(): String? = prefs.getString(KEY_REFRESH, null)

    /** Client_secret de la OAuth App: se pide UNA vez y queda cifrado aquí. */
    fun saveSecret(secret: String) {
        prefs.edit().putString(KEY_SECRET, secret).apply()
    }

    fun getSecret(): String? = prefs.getString(KEY_SECRET, null)

    /** Desconectar: borra la sesión. El client_secret es configuración del
     *  dispositivo (como el secret embebido de una app comercial) y sobrevive
     *  al logout: el siguiente inicio de sesión va directo al selector. */
    fun clear() {
        prefs.edit()
            .remove(KEY_TOKEN)
            .remove(KEY_REFRESH)
            .putBoolean(KEY_LOGGED_OUT, true)
            .apply()
    }

    companion object {
        private const val KEY_TOKEN = "gh_token"
        private const val KEY_REFRESH = "gh_refresh"
        private const val KEY_SECRET = "gh_client_secret"
        private const val KEY_LOGGED_OUT = "logged_out"
    }
}
