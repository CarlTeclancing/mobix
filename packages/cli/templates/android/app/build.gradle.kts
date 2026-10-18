plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android { namespace = "dev.mobix.prototype"; compileSdk = 35
 defaultConfig { applicationId = "dev.mobix.prototype"; minSdk = 26; targetSdk = 35; versionCode = 1; versionName = "0.6"; testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner" }
 buildFeatures { buildConfig = true }
 compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
 kotlinOptions { jvmTarget = "17" }
}
dependencies { implementation("androidx.webkit:webkit:1.12.1"); androidTestImplementation("androidx.test:core:1.6.1"); androidTestImplementation("androidx.test.ext:junit:1.2.1"); androidTestImplementation("androidx.test:runner:1.6.2") }
