plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}
val localApiUrl = providers.gradleProperty("watchApiBaseUrl").orNull
val localCertificate = providers.gradleProperty("watchLocalCertificate").orNull
val localResources = layout.buildDirectory.dir("generated/watchLocalResources")
val generateLocalNetworkConfig by tasks.registering {
    inputs.property("certificatePath", localCertificate.orEmpty())
    if (localCertificate != null) inputs.file(localCertificate)
    outputs.dir(localResources)
    doLast {
        val root = localResources.get().asFile
        root.deleteRecursively()
        root.resolve("xml").mkdirs()
        val localTrust = if (localCertificate != null) {
            root.resolve("raw").mkdirs()
            file(localCertificate).copyTo(root.resolve("raw/watch_local_ca.pem"))
            """<domain-config><domain includeSubdomains="false">localhost</domain><trust-anchors><certificates src="@raw/watch_local_ca" /></trust-anchors></domain-config>"""
        } else ""
        root.resolve("xml/watch_network_security_config.xml").writeText(
            """<network-security-config><base-config cleartextTrafficPermitted="false"><trust-anchors><certificates src="system" /></trust-anchors></base-config>$localTrust</network-security-config>"""
        )
    }
}
tasks.matching { it.name == "preDebugBuild" }.configureEach { dependsOn(generateLocalNetworkConfig) }
android {
    namespace = "com.paydayplanners.watch"
    compileSdk = 36
    defaultConfig {
        testInstrumentationRunner = "com.paydayplanners.watch.ReminderInstrumentation"
        applicationId = "com.paydayplanners.app"
        minSdk = 30
        targetSdk = 36
        versionCode = 1
        versionName = "1.1.2"
        buildConfigField("String", "API_BASE_URL", "\"https://paydayplanners.com/api/v1\"")
    }
    buildTypes {
        getByName("debug") {
            if (localApiUrl != null) {
                require(localApiUrl.matches(Regex("https://[a-zA-Z0-9.:/-]+")))
                buildConfigField("String", "API_BASE_URL", "\"$localApiUrl\"")
            }
        }
    }
    sourceSets["debug"].res.srcDir(localResources)
    buildFeatures { compose = true; buildConfig = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    sourceSets["test"].resources.srcDir("../../contracts")
}
dependencies {
    implementation(platform("androidx.compose:compose-bom:2025.08.00"))
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.wear.compose:compose-foundation:1.5.0")
    implementation("androidx.wear.compose:compose-material3:1.0.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.2")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20250517")
}
