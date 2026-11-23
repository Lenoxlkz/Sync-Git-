plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

/* Todos los scopes que GitHub ofrece hoy a las apps OAuth (docs oficiales
   «Scopes for OAuth apps»). La app los pide todos: el usuario concede en una
   sola pantalla y Orbit habilita cada función según lo concedido, igual que
   hace la web con los scopes del token. Si el OAuth registrado es una GitHub
   App, el parámetro scope se ignora y mandan los permisos configurados en su
   página de ajustes de la app. */
val ORBIT_SCOPES = listOf(
    "repo", "repo:status", "repo_deployment", "public_repo", "repo:invite", "security_events",
    "admin:repo_hook", "write:repo_hook", "read:repo_hook",
    "admin:org", "write:org", "read:org", "admin:org_hook",
    "admin:public_key", "write:public_key", "read:public_key",
    "gist", "discussions", "write:discussion", "read:discussion",
    "notifications", "user", "read:user", "user:email", "user:follow",
    "project", "read:project", "write:project",
    "delete_repo", "write:packages", "read:packages", "delete:packages",
    "admin:gpg_key", "write:gpg_key", "read:gpg_key",
    "admin:ssh_signing", "codespace", "workflow", "read:audit_log", "offline_access",
).joinToString(" ")

/* Firma: si Actions aporta KEYSTORE_BASE64/KEYSTORE_PASSWORD/KEY_ALIAS se usa
   ese keystore estable; si no, el workflow genera uno efímero por build. */
val ksPath = System.getenv("KS_FILE")
val ksPass = System.getenv("KS_PASS")
val ksAlias = System.getenv("KS_ALIAS")
val hasOrbitSigning = ksPath != null && ksPass != null && ksAlias != null && File(ksPath).exists()

android {
    namespace = "com.syncgit.orbit"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.syncgit.orbit"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "4.6.0"
        versionNameSuffix = "-android"

        /* Client ID público de la OAuth de GitHub configurada para Orbit.
           Callback registrada: orbit://oauth/callback */
        buildConfigField("String", "GITHUB_CLIENT_ID", "\"Ov23lidu7f0fKNEIvqbP\"")
        buildConfigField("String", "GITHUB_REDIRECT_URI", "\"orbit://oauth/callback\"")
        buildConfigField("String", "GITHUB_SCOPES", "\"$ORBIT_SCOPES\"")
        /* Opcional: client secret para OAuth Apps clásicas. Se inyecta en CI
           desde el secret GITHUB_CLIENT_SECRET (nunca se sube al repo). */
        buildConfigField("String", "GITHUB_CLIENT_SECRET", "\"${System.getenv("GITHUB_CLIENT_SECRET") ?: ""}\"")
    }

    signingConfigs {
        if (hasOrbitSigning) {
            create("orbit") {
                storeFile = File(ksPath!!)
                storePassword = ksPass
                keyAlias = ksAlias
                keyPassword = ksPass
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (hasOrbitSigning) {
                signingConfig = signingConfigs.getByName("orbit")
            }
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        buildConfig = true
    }
    packaging {
        resources.excludes += setOf("META-INF/AL2.0", "META-INF/LGPL2.1")
    }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
}
