package com.syncgit.orbit

import android.content.Context
import android.util.Log
import java.io.File
import java.util.zip.ZipInputStream

/**
 * Copia la web empaquetada (assets/site.zip) a filesDir y la sirve desde ahí.
 *
 * ¿Por qué un ZIP y no archivos sueltos en assets/? El empaquetador de
 * recursos de Android (aapt) ignora POR DISEÑO los directorios que empiezan
 * por «_» (patrón <dir>_* de ignoreAssetsPattern). La web de Orbit es Next.js
 * y TODO su código vive en «_next/»: al empaquetarla suelta, aapt descartaba
 * _next entero en silencio y el APK quedaba sin CSS y sin JavaScript (la
 * página se veía en blanco y negro y sin funciones). Un único site.zip pasa
 * por assets sin tocar aapt, y la extracción local garantiza que _next exista
 * siempre, con las rutas EXACTAS del build de GitHub Pages (paridad 1:1).
 *
 * La extracción se repite cuando cambia versionCode (cada actualización de la
 * app trae su web nueva). Si una extracción se interrumpe, no se escribe el
 * marcador y la siguiente apertura reextrae desde cero.
 */
object SiteStorage {

    private const val TAG = "OrbitSite"
    private const val SITE_DIR = "site"
    private const val MARKER = ".orbit-site-version"

    /** Carpeta lista para servir, o null si la extracción falló. */
    fun ensureExtracted(context: Context, versionCode: Int): File? {
        val root = File(context.filesDir, SITE_DIR)
        try {
            val marker = File(root, MARKER)
            if (root.isDirectory && marker.isFile &&
                marker.readText().trim().toIntOrNull() == versionCode
            ) {
                return root // ya está la versión actual
            }
            root.deleteRecursively()
            root.mkdirs()

            val assets = context.assets
            val input = assets.open("site.zip")
            input.use { stream ->
                ZipInputStream(stream.buffered()).use { zip ->
                    val rootCanonical = root.canonicalPath + File.separator
                    var count = 0
                    while (true) {
                        val entry = zip.nextEntry ?: break
                        val name = entry.name
                        if (name.isEmpty() || name.contains("..")) {
                            zip.closeEntry(); continue
                        }
                        val out = File(root, name)
                        if (out.canonicalPath != rootCanonical.dropLast(1) &&
                            !out.canonicalPath.startsWith(rootCanonical)
                        ) {
                            throw SecurityException("Ruta fuera de la carpeta del sitio: $name")
                        }
                        if (entry.isDirectory) {
                            out.mkdirs()
                        } else {
                            out.parentFile?.mkdirs()
                            out.outputStream().use { zip.copyTo(it) }
                            count++
                        }
                        zip.closeEntry()
                    }
                    if (count < 10) throw IllegalStateException("site.zip con solo $count archivos")
                    Log.i(TAG, "Web extraída: $count archivos (v$versionCode)")
                }
            }
            marker.writeText(versionCode.toString())
            return root
        } catch (e: Exception) {
            Log.e(TAG, "Extracción del sitio falló", e)
            root.deleteRecursively()
            return null
        }
    }
}
