# Orbit para Android (APK nativo)

App nativa de Android que reproduce **GitHub Orbit** con paridad completa
respecto a la web: mismo build de Next.js que GitHub Pages, mismos temas
(Liquid Glass, Material 3 Expressive, Modo Simple), mismas vistas, funciones,
flujos y animaciones. La web del repositorio **no se toca**: sigue
desplegándose en `https://lenoxlkz.github.io/Sync-Git-/` con su workflow
`deploy.yml` habitual.

## Cómo viaja la web dentro del APK

El workflow compila la web (`npm ci` + `npm run build` → `out/`) y la
empaqueta como **un único `assets/site.zip`**. En el primer arranque (y tras
cada actualización, detectado por `versionCode`) `SiteStorage` extrae el ZIP a
`filesDir/site` y `MainActivity` lo sirve bajo el origen seguro
`https://appassets.androidplatform.net` con el mismo basePath `/Sync-Git-` que
usa GitHub Pages.

> ¿Por qué un ZIP y no archivos sueltos en `assets/`? El empaquetador de
> recursos de Android (aapt) **ignora por diseño los directorios que empiezan
> por «_»** (patrón `<dir>_*` del `ignoreAssetsPattern`). La web es Next.js y
> todo su código vive en `_next/`: empaquetada suelta, aapt descartaba `_next`
> en silencio y el APK quedaba sin CSS y sin JavaScript (página en blanco y
> negro, sin funciones). El ZIP pasa por aapt como un archivo opaco y la
> extracción garantiza que `_next` exista siempre con las rutas exactas.

## Única diferencia con la web: el inicio de sesión

La web usa Personal Access Token pegado en Control Center. La app usa el
**OAuth oficial de GitHub** (Client ID `Ov23li…`, callback registrada
`orbit://oauth/callback`) y entrega el token a la web por
`sessionStorage('orbit.token')` — la misma vía que la web usa con el PAT, así
que todo lo demás (scopes, secciones, bóveda, chat IA…) funciona igual.

Dos flujos oficiales, el mismo token y los mismos scopes
(`GitHubOAuth.kt`):

- **Con `client_secret`** (secret `GITHUB_CLIENT_SECRET` en Actions):
  WebView dentro de la app → `github.com/login/oauth/authorize` →
  redirect a `orbit://oauth/callback?code=…` (interceptado por el WebView o
  por el intent-filter) → intercambio del `code` por el token.
- **Sin `client_secret`** (estado actual): **flujo por dispositivo** oficial
  de GitHub. VERIFICADO contra la API real: para OAuth Apps el intercambio
  del `code` exige `client_secret` (sin él responde
  `incorrect_client_credentials`; PKCE no lo sustituye), mientras que el
  device flow funciona solo con el Client ID. La app muestra el código en
  pantalla (botón «Copiar código») y abre `github.com/login/device` en su
  propio WebView; el token llega por polling. Añade el secret
  `GITHUB_CLIENT_SECRET` y la app pasa automáticamente al flujo de callback
  sin cambiar nada más.

Scopes solicitados: los que GitHub acepta realmente para OAuth Apps,
verificados contra `/login/device/code` (que rechaza los inexistentes):
`repo repo:status repo_deployment public_repo repo:invite security_events
admin:repo_hook write:repo_hook read:repo_hook admin:org write:org read:org
admin:org_hook admin:public_key write:public_key read:public_key gist
notifications user read:user user:email user:follow project read:project
delete_repo write:packages read:packages delete:packages admin:gpg_key
write:gpg_key read:gpg_key codespace workflow`.
No existen en la API de GitHub: `discussions`, `write:project`,
`admin/read/write:ssh_signing`, `offline_access` (se comprobaron y se
excluyeron; pedirlas rompía el login con `invalid_scope`).

## Firma y actualizaciones

Todos los builds se firman con el **mismo keystore** (secrets
`KEYSTORE_BASE64` + `KEYSTORE_PASSWORD` + `KEY_ALIAS` del repositorio). El
workflow falla a propósito si faltan: un keystore efímero por build daría a
cada APK una firma distinta y obligaría a desinstalar antes de cada
actualización. `versionCode` = número de run de Actions (monotónico), así que
cada compilación nueva se instala directamente encima de la anterior.

## Compilación

El workflow `.github/workflows/android-apk.yml` (trigger: push a `main` o
manual) hace, en este orden:

1. `npm ci` + `npm run build` → export estático de la web en `out/`
   (idéntico al que publica Pages).
2. `out/` → `android/app/src/main/assets/site.zip`, **con validación
   anti-regresión**: el build falla si el ZIP no contiene
   `_next/static/chunks/` ni `_next/static/css/` (el bug histórico del
   `_next` descartado no puede volver a ocurrir sin romper el build).
3. Java 17 + Gradle 8.10.2 → `gradle assembleRelease` con
   `ORBIT_VERSION_CODE` = número de run.
4. Firma con el keystore estable de los secrets.
5. Publica el APK como artifact `Orbit-Android-APK` y en **Releases →
   `android-latest`** (reemplazado en cada build).

## Estructura

```
android/
  app/build.gradle.kts        Client ID OAuth, scopes, firma, versionCode por run
  app/src/main/
    AndroidManifest.xml       MainActivity (shell) + OAuthActivity + intent-filter orbit://oauth/callback
    java/com/syncgit/orbit/
      MainActivity.kt         WebView + WebViewAssetLoader (origen appassets.androidplatform.net),
                              inyección del shell, puente JS, descargas, file chooser, barras del sistema
      SiteStorage.kt          extracción de assets/site.zip → filesDir (con protección zip-slip)
      OAuthActivity.kt        OAuth oficial: device flow en pantalla o WebView de autorización
      GitHubOAuth.kt          authorize URL + exchange code→token + device flow
      TokenStore.kt           token cifrado (EncryptedSharedPreferences, fallback a prefs privadas)
    assets/
      site.zip                la web de Orbit (la empaqueta el workflow desde out/)
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
- El shell re-habilita y renombra el botón de conexión («Verificar y
  conectar» → «Iniciar sesión con GitHub»): nace `disabled` hasta escribir un
  PAT, pero en la app el input de PAT está oculto — el login nativo no depende
  de ese formulario. Los cambios estéticos se aplican tras la hidratación de
  React para no provocar mismatch.
- Descargas (`a[download]` con blob) se convierten en archivos reales en
  `Descargas/Orbit` + hoja de compartir; los enlaces externos abren el
  navegador; la subida de archivos usa el selector de archivos de Android.
