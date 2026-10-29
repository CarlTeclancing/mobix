import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Release signing is opt-in. Credentials are read from android/keystore.properties
// (git-ignored) or MOBIX_* environment variables and are never committed.
val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties().apply {
    if (keystorePropertiesFile.exists()) {
        keystorePropertiesFile.inputStream().use { load(it) }
    }
}
fun signingValue(key: String, environment: String): String? =
    keystoreProperties.getProperty(key) ?: System.getenv(environment)

val storeFilePath = signingValue("storeFile", "MOBIX_KEYSTORE_FILE")
val storePasswordValue = signingValue("storePassword", "MOBIX_KEYSTORE_PASSWORD")
val keyAliasValue = signingValue("keyAlias", "MOBIX_KEY_ALIAS")
val keyPasswordValue = signingValue("keyPassword", "MOBIX_KEY_PASSWORD")
val hasReleaseSigning = listOf(storeFilePath, storePasswordValue, keyAliasValue, keyPasswordValue).all { !it.isNullOrBlank() }

android {
    namespace = "dev.mobix.prototype"
    compileSdk = 35

    defaultConfig {
        applicationId = "dev.mobix.prototype"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.10.0-beta.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
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

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(storeFilePath!!)
                storePassword = storePasswordValue
                keyAlias = keyAliasValue
                keyPassword = keyPasswordValue
            }
        }
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            isShrinkResources = false
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    lint {
        abortOnError = true
        warningsAsErrors = false
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
    androidTestImplementation("androidx.test:core:1.6.1")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
}
