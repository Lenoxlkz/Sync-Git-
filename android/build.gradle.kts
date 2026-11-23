/* Orbit para Android — proyecto Gradle.
   La web (Next.js) vive en el raíz del repo y se sirve en GitHub Pages;
   este módulo la empaqueta tal cual dentro del APK (assets/site) para que
   la app sea idéntica a la web en todos los aspectos. */
plugins {
    id("com.android.application") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
}
