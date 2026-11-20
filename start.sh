#!/bin/sh
# GitHub Orbit Next — arranque de nginx para Render
# · Puerto desde $PORT (por defecto 10000)
# · Basic Auth SIEMPRE que existan BASIC_AUTH_USER y BASIC_AUTH_PASS
#   (uso exclusivo personal: sin credenciales el sitio queda abierto)
set -e
PORT="${PORT:-10000}"

AUTH_DIRECTIVES=""
if [ -n "$BASIC_AUTH_USER" ] && [ -n "$BASIC_AUTH_PASS" ]; then
  htpasswd -bc /etc/nginx/.htpasswd "$BASIC_AUTH_USER" "$BASIC_AUTH_PASS" >/dev/null
  AUTH_DIRECTIVES='auth_basic "Orbit — acceso personal";
        auth_basic_user_file /etc/nginx/.htpasswd;'
fi

cat > /etc/nginx/conf.d/default.conf <<EOF
server {
    listen ${PORT};
    server_name _;
    root  /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/html text/css application/javascript application/json image/svg+xml application/manifest+json text/plain;
    gzip_min_length 512;

    add_header X-Content-Type-Options nosniff always;

    # salud para Render
    location = /healthz {
        access_log off;
        default_type text/plain;
        return 200 'ok\n';
    }

    # assets con hash de Next: inmutables, un año de caché
    location /_next/static/ {
${AUTH_DIRECTIVES}
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        add_header X-Content-Type-Options nosniff always;
    }

    # shell y service worker: siempre frescos tras cada despliegue
    location = /sw.js {
${AUTH_DIRECTIVES}
        add_header Cache-Control "no-cache" always;
        add_header X-Content-Type-Options nosniff always;
    }

    location = /index.html {
${AUTH_DIRECTIVES}
        add_header Cache-Control "no-cache" always;
        add_header X-Content-Type-Options nosniff always;
    }

    # rutas de Next con export estático: /repos/ → /repos/index.html
    location / {
${AUTH_DIRECTIVES}
        add_header X-Content-Type-Options nosniff always;
        try_files \$uri \$uri/index.html \$uri/ /index.html;
    }
}
EOF

exec nginx -g "daemon off;"
