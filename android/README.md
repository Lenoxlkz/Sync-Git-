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
`orbit://oauth/callback`) **con el selector de cuentas de GitHub** — el mismo
patrón que cualquier app nativa con deep link — y entrega el token a la web por
`sessionStorage('orbit.token')` — la misma vía que la web usa con el PAT, así
que todo lo demás (scopes, secciones, bóveda, chat IA…) funciona igual.

El flujo, paso a paso (`OAuthActivity.kt` + `GitHubOAuth.kt`):

1. «Iniciar sesión» → WebView dentro de la app que abre DIRECTAMENTE la
   pantalla oficial de selección de cuenta de GitHub:
   `https://github.com/login/oauth/select_account?client_id=…&redirect_uri=
   orbit%3A%2F%2Foauth%2Fcallback&response_type=code&scope=…&state=…&
   code_challenge=…&code_challenge_method=S256` (Client ID de Orbit, state,
   PKCE S256 y la callback registrada, sincronizados en una sola URL).
2. GitHub muestra de una vez las cuentas con sesión activa («Signed in as … →
   Continue») o «Use a different account»; si la WebView no tiene sesión,
   primero pide login y regresa al selector. VERIFICADO contra el endpoint
   real: sin sesión responde 302 a `/login` conservando el `return_to` con
   TODOS los parámetros.
3. Al elegir cuenta, GitHub redirige a `orbit://oauth/callback?code=…`
   (interceptado por la WebView o por el intent-filter) y la app intercambia
   el `code` por el token.
4. Cadena de respaldo de URLs: `select_account` → `authorize` con
   `prompt=select_account` → `authorize` clásica. Si GitHub retirara alguna
   ruta, la WebView prueba la siguiente sin que el usuario note nada.

**El client_secret es imprescindible para el intercambio** — VERIFICADO contra
el endpoint real (POST `/login/oauth/access_token`): GitHub responde
`incorrect_client_credentials` sin él, con o sin PKCE, ANTES de validar el
`code`, y PKCE no lo sustituye (probado con varios client_id, incluido el de
una app comercial con este mismo patrón). Dos vías para dárselo:

- **Embebido (cero fricción, como hacen las apps comerciales)**: secret
  `CLIENT_SECRET` en Actions —GitHub no permite crear secretos con prefijo
  `GITHUB_`, están reservados— mapeado a la env `GITHUB_CLIENT_SECRET` por el
  workflow → el APK lo trae dentro (`BuildConfig`) → el selector de cuentas
  funciona al instante y sin preguntas.
- **Pedido una sola vez en la app**: sin secret embebido, la app muestra una
  pantalla propia la primera vez —con enlace directo a
  github.com/settings/developers → «Git Orbit» → «Generate a new client
  secret»—, lo guarda CIFRADO (EncryptedSharedPreferences) y no vuelve a
  preguntar; «Desconectar» NO lo borra.

El **device flow** oficial de GitHub (funciona solo con client_id) queda como
respaldo secundario (botón «Prefiero el flujo por dispositivo») para quien no
quiera tocar secrets.

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
      OAuthActivity.kt        OAuth oficial: selector de cuentas de GitHub (select_account),
                              client_secret una vez (cifrado) y device flow de respaldo
      GitHubOAuth.kt          URLs de autorización (select_account → prompt → clásica) + PKCE +
                              exchange code→token + device flow
      TokenStore.kt           token y client_secret cifrados (EncryptedSharedPreferences, fallback
                              a prefs privadas)
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
  `Descargas/Orbit` + hoja para compartir; los enlaces externos abren el
  navegador; la subida de archivos usa el selector de archivos de Android.
