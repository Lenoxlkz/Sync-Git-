/* Orbit Android — puente nativo.
   Este script SOLO vive dentro del APK: se inyecta en cada página HTML que la
   app sirve desde assets/site (la web de GitHub Pages nunca se modifica y
   sigue funcionando igual). Hace de pegamento entre la web y la app nativa:

   1. Sesión OAuth: el token nativo llega en window.__ORBIT_NATIVE_TOKEN__ y se
      entrega a la web por sessionStorage('orbit.token'), la MISMA vía que usa
      la web con el PAT — boot() la restaura y todo Orbit funciona igual.
   2. Logout: si la web desconecta (Control Center → Desconectar, Borrar todo),
      también se borra el token nativo.
   3. Login: reemplaza el acceso por PAT de Control Center por el OAuth oficial
      de GitHub (WebView → orbit://oauth/callback → PKCE → token).
   4. Tema: informa dark/light a la app para pintar las barras del sistema.
   5. Descargas: los blob: de la web se convierten en archivos reales de
      Android (Descargas/Orbit) con el mismo nombre de archivo.
   6. Enlaces externos (github.com, etc.) abren el navegador, no el WebView. */
(function () {
  'use strict';
  var B = window.AndroidBridge;
  if (!B) return;

  /* ---------- 1 · sesión OAuth → sessionStorage (antes de boot()) ---------- */
  try {
    if (window.__ORBIT_NATIVE_TOKEN__) {
      sessionStorage.setItem('orbit.token', window.__ORBIT_NATIVE_TOKEN__);
    }
  } catch (e) { /* almacenamiento privado */ }

  /* ---------- 2 · logout web → logout nativo ---------- */
  var logoutTimer = null;
  function scheduleLogoutCheck() {
    if (logoutTimer) clearTimeout(logoutTimer);
    logoutTimer = setTimeout(function () {
      var t = null;
      try { t = sessionStorage.getItem('orbit.token'); } catch (e) { return; }
      if (!t) { try { B.onWebLogout(); } catch (e) { } }
    }, 80);
  }
  try {
    var _remove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (k) {
      if (k === 'orbit.token' && this === sessionStorage) scheduleLogoutCheck();
      return _remove.apply(this, arguments);
    };
    var _clear = Storage.prototype.clear;
    Storage.prototype.clear = function () {
      if (this === sessionStorage) scheduleLogoutCheck();
      return _clear.apply(this, arguments);
    };
  } catch (e) { /* sin hooks */ }

  /* ---------- 4 · tema → barras del sistema ---------- */
  function reportChrome() {
    try {
      B.setChrome(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    } catch (e) { }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', reportChrome);
  } else {
    reportChrome();
  }
  try {
    new MutationObserver(reportChrome)
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  } catch (e) { }

  /* ---------- 5 · descargas blob → archivos reales ---------- */
  function blobToB64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(',')[1] || ''); };
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }
  document.addEventListener('click', function (e) {
    if (!e.target || !e.target.closest) return;
    var a = e.target.closest('a[download]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('blob:') !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    fetch(href)
      .then(function (r) { return r.blob(); })
      .then(function (b) {
        return blobToB64(b).then(function (b64) {
          B.saveFile(a.getAttribute('download') || 'orbit-archivo', b64, b.type || '');
        });
      })
      .catch(function () {
        try { B.toast('No se pudo guardar el archivo', 'err'); } catch (x) { }
      });
  }, true);

  /* ---------- 3 · Control Center: OAuth en lugar de PAT ---------- */

  /* El campo de token desaparece (ambos motores visuales) */
  function ensureStyle() {
    if (document.getElementById('orbit-android-style')) return;
    var st = document.createElement('style');
    st.id = 'orbit-android-style';
    st.textContent =
      'input[aria-label="Personal Access Token"],' +
      '[aria-label="Personal Access Token"]{display:none!important;}';
    document.head.appendChild(st);
  }

  var BTN_SEL = 'button, [data-orbit-md]';
  var OAUTH_LABELS = {
    'Verificar y conectar': 'Iniciar sesión con GitHub',
    'Iniciar sesión con GitHub': 'Iniciar sesión con GitHub',
    'Reemplazar token': 'Cambiar de cuenta',
    'Cambiar de cuenta': 'Cambiar de cuenta',
  };

  /* Cambia el texto respetando el DOM de cada motor:
     · botones HTML (Liquid Glass): textContent directo.
     · botones @material/web (Expressive): el label es un nodo de texto
       light-DOM dentro del host — se sustituye ese nodo, no todo el host. */
  function setBtnText(el, label) {
    if (el.tagName && el.tagName.indexOf('MD-') === 0) {
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
      var first = null;
      var n;
      while ((n = walker.nextNode())) {
        if ((n.nodeValue || '').trim()) { first = n; break; }
      }
      if (first) {
        first.nodeValue = label;
        var rest;
        while ((rest = walker.nextNode())) {
          if ((rest.nodeValue || '').trim()) rest.nodeValue = '';
        }
        return true;
      }
      return false;
    }
    el.textContent = label;
    return true;
  }

  function renameButton(el) {
    if (el.dataset.orbitOauth) return;
    var txt = (el.textContent || '').trim();
    var label = OAUTH_LABELS[txt];
    if (!label) return;
    if (setBtnText(el, label)) el.dataset.orbitOauth = '1';
  }

  function patchTexts() {
    /* nota bajo el botón de conexión */
    var hints = document.querySelectorAll('p.tiny');
    for (var i = 0; i < hints.length; i++) {
      var p = hints[i];
      if (p.dataset.orbitHint) continue;
      if ((p.textContent || '').indexOf('Crea el token en github.com') >= 0) {
        p.dataset.orbitHint = '1';
        p.textContent = 'Inicio de sesión OAuth oficial de GitHub: al pulsar el botón se abre la pantalla de autorización y la app recibe un token con todos los permisos concedidos. Nada sale de tu dispositivo.';
      }
    }
    /* subtítulo de la sección «Conexión con GitHub» */
    var heads = document.querySelectorAll('.section-head h2');
    for (var j = 0; j < heads.length; j++) {
      var h = heads[j];
      if ((h.textContent || '').trim() !== 'Conexión con GitHub') continue;
      var sub = h.parentNode.querySelector('p');
      if (sub && !sub.dataset.orbitSub) {
        sub.dataset.orbitSub = '1';
        sub.textContent = 'OAuth oficial de GitHub · sesión con todos los permisos que concedas';
      }
    }
  }

  var scheduled = false;
  function queuePatch() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      try {
        ensureStyle();
        var btns = document.querySelectorAll(BTN_SEL);
        for (var i = 0; i < btns.length; i++) renameButton(btns[i]);
        patchTexts();
      } catch (e) { }
    });
  }

  function startObserver() {
    try {
      new MutationObserver(queuePatch)
        .observe(document.body, { childList: true, subtree: true });
    } catch (e) { }
    queuePatch();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }

  /* Clic → OAuth (fase de captura: corre ANTES de los handlers de React,
     incluidos los de los web components md-*). */
  document.addEventListener('click', function (e) {
    if (!e.target || !e.target.closest) return;
    var btn = e.target.closest(BTN_SEL);
    if (!btn) return;
    var txt = (btn.textContent || '').trim();
    if (btn.dataset.orbitOauth === '1' || OAUTH_LABELS[txt]) {
      if (btn.disabled) return;
      e.preventDefault();
      e.stopPropagation();
      try { B.startOAuth(); } catch (err) { }
    }
  }, true);

  /* ---------- 6 · enlaces externos → navegador ---------- */
  document.addEventListener('click', function (e) {
    if (!e.target || !e.target.closest) return;
    var a = e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('https://appassets.androidplatform.net') === 0) return;
    if (href.indexOf('http://') === 0 || href.indexOf('https://') === 0) {
      e.preventDefault();
      e.stopPropagation();
      try { B.openExternal(href); } catch (x) { }
    }
  }, true);
})();
