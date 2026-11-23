# Orbit para Android (APK nativo)

App nativa de Android que reproduce **GitHub Orbit** con paridad completa
respecto a la web: mismo build de Next.js que GitHub Pages, mismos temas
(Liquid Glass, Material 3 Expressive, Modo Simple), mismas vistas, funciones,
flujos y animaciones. La web del repositorio **no se toca**: sigue
desplegándose en `https://lenoxlkz.github.io/Sync-Git-/` con su workflow
`deploy.yml` habitual.

## Única diferencia con la web: el inicio de sesión

La web usa Personal Access Token pegado en Control Center. La app usa el
**OAuth oficial de GitHub**:

1. «Iniciar sesión» (Control Center) → se abre un **WebView dentro de la app**.
2. Se muestra la pantalla de autorización oficial de GitHub.
3. El usuario concede los permisos.
4. GitHub redirige a la app por el esquema registrado **orbit://oauth/callback**
   (intent-filter + interceptor del WebView).
5. La app recibe el `code`, lo intercambia por el token con **PKCE S256**
   (GitHub soporta PKCE en OAuth Apps y GitHub Apps desde julio 2025) y entrega
   el token a la web por `sessionStorage('orbit.token')` — la misma vía que la
   web usa con el PAT, así que todo lo demás (scopes, secciones del menú,
   bóveda, chat IA…) funciona exactamente igual.

Se piden **todos los scopes** que GitHub ofrece a apps OAuth
(`repo`, `workflow`, `admin:org`, `delete_repo`, `gist`, `notifications`,
`user`, packages, gpg keys, discussions, projects, `codespace`,
`read:audit_log`, `offline_access`, …). Nota: si el OAuth registrado
(`Ov23li…`) es una **GitHub App**, GitHub ignora el parámetro `scope` y aplican
los permisos configurados en la página de la app en Developer settings —
actívalos todos ahí para equivalencia total.

Respaldo automático: si el intercambio del `code` exigiera `client_secret`
(OAuth App clásica) y no hay uno configurado, la app cae al **flujo por
dispositivo** oficial de GitHub (`github.com/login/device`), que funciona solo
con el Client ID y pide los mismos scopes. Para usar `client_secret` sin
respaldo, añade el secret `GITHUB_CLIENT_SECRET` al repositorio (BuildConfig).

## Compilación

El workflow `.github/workflows/android-apk.yml` (trigger: push a `main` o
manual) hace, en este orden:

1. `npm ci` + `npm run build` → export estático de la web en `out/`
   (idéntico al que publica Pages).
2. Copia `out/` → `android/app/src/main/assets/site/` (la web viaja dentro del
   APK: funciona offline y con paridad exacta).
3. Java 17 + Gradle 8.10.2 → `gradle assembleRelease`.
4. Firma: usa los secrets `KEYSTORE_BASE64` + `KEYSTORE_PASSWORD` + `KEY_ALIAS`
   si existen; si no, genera un keystore efímero por build (reinstalación
   requiere desinstalar la versión anterior; crea esos secrets para firma
   estable).
5. Publica el APK como artifact `Orbit-Android-APK` y en **Releases →
   `android-latest`** (reemplazado en cada build).

## Estructura

```
android/
  app/build.gradle.kts        Client ID OAuth, scopes, firma, dependencias
  app/src/main/
    AndroidManifest.xml       MainActivity (shell) + OAuthActivity + intent-filter orbit://oauth/callback
    java/com/syncgit/orbit/
      MainActivity.kt         WebView + WebViewAssetLoader (origen appassets.androidplatform.net),
                              inyección del shell, puente JS, descargas, file chooser, barras del sistema
      OAuthActivity.kt        OAuth oficial (WebView de autorización, PKCE, device flow de respaldo)
      GitHubOAuth.kt          authorize URL + exchange code→token + device flow
      TokenStore.kt           token cifrado (EncryptedSharedPreferences, fallback a prefs privadas)
    assets/
      site/                   la web de Orbit (la copia el workflow desde out/)
      shell/app-shell.js      puente nativo (sesión OAuth, logout, login OAuth,
                              tema, descargas, enlaces externos) — solo en la app
    res/                      icono adaptativo (logo Orbit), temas edge-to-edge
.github/workflows/
  android-apk.yml             build del APK (este módulo)
  deploy.yml                  despliegue de la web a Pages (sin cambios)
```

## Cómo funciona la paridad

- La app sirve el MISMO export estático que Pages, con el mismo basePath
  `/Sync-Git-`, bajo el origen seguro `https://appassets.androidplatform.net`
  (WebViewAssetLoader): localStorage/sessionStorage, fetch a `api.github.com`,
  service worker y CORS funcionan igual que en la web.
- La detección de motor visual usa el User-Agent de Android: Android ≤13 →
  Material 3 Expressive (bajo consumo), Android ≥14 → Liquid Glass; el usuario
  puede fijarlo en Control Center, igual que en la web.
- El `sessionStorage` de la sesión se repone desde el token nativo en cada
  carga de página: la sesión sobrevive al cierre de la app.
- «Desconectar» y «Borrar todo» en la web limpian también el token nativo.
- Descargas (`a[download]` con blob) se convierten en archivos reales en
  `Descargas/Orbit` + hoja de compartir; los enlaces externos abren el
  navegador; la subida de archivos usa el selector de archivos de Android.
