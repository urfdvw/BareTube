plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "io.github.urfdvw.baretube"
    compileSdk = 35

    defaultConfig {
        applicationId = "io.github.urfdvw.baretube"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "APP_URL", "\"https://urfdvw.github.io/BareTube/\"")
    }

    // A fixed key lets new builds install over old ones (keeping the YouTube login).
    // Provided by CI from repository secrets; falls back to the debug key.
    val keystorePath = System.getenv("BARETUBE_KEYSTORE")
    signingConfigs {
        if (keystorePath != null) {
            create("baretube") {
                storeFile = file(keystorePath)
                storePassword = System.getenv("BARETUBE_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("BARETUBE_KEY_ALIAS")
                keyPassword = System.getenv("BARETUBE_KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("baretube") ?: signingConfigs.getByName("debug")
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.media:media:1.7.0")
}
