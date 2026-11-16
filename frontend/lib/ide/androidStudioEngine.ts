// Pure TypeScript engine for Google Android Studio (New UI Dark) clone.
// Zero "@/" path aliases and ES5-iteration-safe so both Next.js and Node --experimental-strip-types run cleanly.

export type AndroidViewMode = "Android" | "Project" | "Packages";
export type EditorSplitMode = "Code" | "Split" | "Design";
export type DesignSurfaceMode = "Design" | "Blueprint" | "Both";
export type LogcatLevel = "V" | "D" | "I" | "W" | "E" | "A";
export type StudioFileKind = "kotlin" | "xml" | "manifest" | "gradle-kts" | "properties" | "toml" | "proguard" | "svg";

export interface StudioFile {
  id: string;
  name: string;
  tabTitle: string;
  path: string;
  breadcrumbs: string[];
  kind: StudioFileKind;
  androidHint?: string;
  isTest?: boolean;
  hasComposePreview?: boolean;
  isLayoutXml?: boolean;
  content: string;
}

export interface StudioProjectPreset {
  id: string;
  name: string;
  monogram: string;
  monogramBg: string;
  packageName: string;
  branch: string;
  files: StudioFile[];
}

export interface AndroidTreeNode {
  id: string;
  label: string;
  hint?: string;
  kind:
    | "module"
    | "source-root"
    | "resources-root"
    | "folder"
    | "package"
    | "gradle-root"
    | "file";
  fileId?: string;
  fileKind?: StudioFileKind;
  isTest?: boolean;
  children?: AndroidTreeNode[];
}

export interface StudioDeviceProfile {
  id: string;
  name: string;
  adbSerial: string;
  apiLevel: number;
  androidVersion: string;
  widthDp: number;
  heightDp: number;
  formFactor: "Phone" | "Foldable" | "Tablet";
  booted: boolean;
}

export interface SdkPackageItem {
  id: string;
  name: string;
  apiLevel: string;
  revision: string;
  category: "platform" | "tool";
  installed: boolean;
  sizeLabel: string;
}

export interface PreviewWidgetNode {
  id: string;
  type: "Column" | "Row" | "Surface" | "Box" | "Card" | "ConstraintLayout" | "LinearLayout" | "Text" | "TextView" | "Button" | "Spacer" | "TextField" | "Switch" | "TopAppBar";
  text?: string;
  modifierLabel?: string;
  background?: string;
  textColor?: string;
  fontSize?: number;
  fontWeight?: "normal" | "bold" | "semibold";
  onClickAction?: string;
  children: PreviewWidgetNode[];
}

export interface StudioProblem {
  id: string;
  fileId: string;
  fileName: string;
  line: number;
  column: number;
  severity: "error" | "warning" | "info";
  message: string;
}

export interface LogcatEntry {
  id: string;
  timestamp: string;
  pid: number;
  tid: number;
  tag: string;
  packageName: string;
  level: LogcatLevel;
  message: string;
  isCrash?: boolean;
}

export interface GradleBuildStep {
  id: string;
  label: string;
  status: "success" | "failed" | "up-to-date";
  durationMs: number;
  detail?: string;
}

export interface AndroidRunResult {
  success: boolean;
  stdout: string[];
  errors: StudioProblem[];
  buildSteps: GradleBuildStep[];
  previewTree: PreviewWidgetNode;
  logcatEmitted: LogcatEntry[];
  durationMs: number;
}

export interface TerminalExecResult {
  lines: string[];
  clear?: boolean;
}

export const LOGCAT_TAG_PALETTE: string[] = [
  "#929292",
  "#A9B7C6",
  "#D28546",
  "#A8C023",
  "#AE8ABE",
  "#D27981",
  "#3AA192",
  "#FFC66D",
  "#029CDE",
  "#19A492",
  "#A388B4",
  "#B78A57",
  "#7292CA",
  "#BBB529",
  "#D36FB1",
  "#4291FF",
];

export const DEFAULT_DEVICES: StudioDeviceProfile[] = [
  {
    id: "medium-phone-35",
    name: "Medium Phone API 35",
    adbSerial: "emulator-5554",
    apiLevel: 35,
    androidVersion: "Android 15",
    widthDp: 411,
    heightDp: 915,
    formFactor: "Phone",
    booted: true,
  },
  {
    id: "pixel-8-34",
    name: "Pixel 8 API 34",
    adbSerial: "emulator-5556",
    apiLevel: 34,
    androidVersion: "Android 14",
    widthDp: 412,
    heightDp: 915,
    formFactor: "Phone",
    booted: false,
  },
  {
    id: "pixel-fold-35",
    name: "Pixel Fold API 35",
    adbSerial: "emulator-5558",
    apiLevel: 35,
    androidVersion: "Android 15",
    widthDp: 673,
    heightDp: 841,
    formFactor: "Foldable",
    booted: false,
  },
  {
    id: "pixel-tablet-34",
    name: "Pixel Tablet API 34",
    adbSerial: "emulator-5560",
    apiLevel: 34,
    androidVersion: "Android 14",
    widthDp: 1280,
    heightDp: 800,
    formFactor: "Tablet",
    booted: false,
  },
];

export const DEFAULT_SDK_PACKAGES: SdkPackageItem[] = [
  {
    id: "android-35",
    name: "Android 15.0 (\"VanillaIceCream\")",
    apiLevel: "35",
    revision: "Rev. 2",
    category: "platform",
    installed: true,
    sizeLabel: "92 MB",
  },
  {
    id: "android-34",
    name: "Android 14.0 (\"UpsideDownCake\")",
    apiLevel: "34",
    revision: "Rev. 3",
    category: "platform",
    installed: true,
    sizeLabel: "88 MB",
  },
  {
    id: "android-33",
    name: "Android 13.0 (\"Tiramisu\")",
    apiLevel: "33",
    revision: "Rev. 3",
    category: "platform",
    installed: false,
    sizeLabel: "84 MB",
  },
  {
    id: "build-tools-35",
    name: "Android SDK Build-Tools 35.0.0",
    apiLevel: "35.0.0",
    revision: "35.0.0",
    category: "tool",
    installed: true,
    sizeLabel: "58 MB",
  },
  {
    id: "platform-tools",
    name: "Android SDK Platform-Tools",
    apiLevel: "35.0.2",
    revision: "35.0.2",
    category: "tool",
    installed: true,
    sizeLabel: "18 MB",
  },
  {
    id: "emulator-pkg",
    name: "Android Emulator",
    apiLevel: "35.2.10",
    revision: "35.2.10",
    category: "tool",
    installed: true,
    sizeLabel: "340 MB",
  },
  {
    id: "ndk-lts",
    name: "NDK (Side by side) 27.0.12077973",
    apiLevel: "27.0",
    revision: "27.0",
    category: "tool",
    installed: false,
    sizeLabel: "612 MB",
  },
];

export const MAIN_ACTIVITY_KT = `package com.example.myapplication

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.example.myapplication.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        Log.i("MainActivity", "onCreate: initialized Compose content")
        setContent {
            MyApplicationTheme {
                Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                    Greeting(
                        name = "Android",
                        modifier = Modifier.padding(innerPadding)
                    )
                }
            }
        }
    }
}

@Composable
fun Greeting(name: String, modifier: Modifier = Modifier) {
    var clicks by remember { mutableStateOf(0) }
    Column(
        modifier = modifier.fillMaxSize(),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "Hello $name!",
            modifier = modifier
        )
        Button(onClick = { clicks++ }) {
            Text(text = "Clicked $clicks times")
        }
    }
}

@Preview(showBackground = true)
@Composable
fun GreetingPreview() {
    MyApplicationTheme {
        Greeting("Android")
    }
}
`;

export const ACTIVITY_MAIN_XML = `<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    xmlns:tools="http://schemas.android.com/tools"
    android:id="@+id/main"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    tools:context=".MainActivity">

    <TextView
        android:id="@+id/greetingText"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Hello Android!"
        android:textSize="22sp"
        app:layout_constraintBottom_toBottomOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintTop_toTopOf="parent" />

    <Button
        android:id="@+id/actionButton"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Launch Module"
        app:layout_constraintTop_toBottomOf="@id/greetingText"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintStart_toStartOf="parent" />

</androidx.constraintlayout.widget.ConstraintLayout>
`;

export const ANDROID_MANIFEST_XML = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <application
        android:allowBackup="true"
        android:dataExtractionRules="@xml/data_extraction_rules"
        android:fullBackupContent="@xml/backup_rules"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.MyApplication"
        tools:targetApi="31">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:label="@string/app_name"
            android:theme="@style/Theme.MyApplication">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>
`;

export const STRINGS_XML = `<resources>
    <string name="app_name">My Application</string>
    <string name="welcome_subtitle">Ready on Pixel Emulator</string>
</resources>
`;

export const COLORS_XML = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="purple_200">#FFBB86FC</color>
    <color name="purple_500">#FF6200EE</color>
    <color name="purple_700">#FF3700B3</color>
    <color name="teal_200">#FF03DAC5</color>
    <color name="teal_700">#FF018786</color>
    <color name="black">#FF000000</color>
    <color name="white">#FFFFFFFF</color>
</resources>
`;

export const THEMES_XML = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.MyApplication" parent="android:Theme.Material.Light.NoActionBar" />
</resources>
`;

export const COLOR_KT = `package com.example.myapplication.ui.theme

import androidx.compose.ui.graphics.Color

val Purple80 = Color(0xFFD0BCFF)
val PurpleGrey80 = Color(0xFFCCC2DC)
val Pink80 = Color(0xFFEFB8C8)

val Purple40 = Color(0xFF6650A4)
val PurpleGrey40 = Color(0xFF625B71)
val Pink40 = Color(0xFF7D5260)
`;

export const THEME_KT = `package com.example.myapplication.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = Purple80,
    secondary = PurpleGrey80,
    tertiary = Pink80
)

private val LightColorScheme = lightColorScheme(
    primary = Purple40,
    secondary = PurpleGrey40,
    tertiary = Pink40
)

@Composable
fun MyApplicationTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
`;

export const BUILD_GRADLE_MODULE_KTS = `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.example.myapplication"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.example.myapplication"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildFeatures {
        compose = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.material3)
}
`;

export const BUILD_GRADLE_PROJECT_KTS = `// Top-level build file where you can add configuration options common to all sub-projects/modules.
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
}
`;

export const LIBS_VERSIONS_TOML = `[versions]
agp = "8.7.2"
kotlin = "2.0.21"
coreKtx = "1.15.0"
lifecycleRuntimeKtx = "2.8.7"
activityCompose = "1.9.3"
composeBom = "2024.10.01"

[libraries]
androidx-core-ktx = { group = "androidx.core.ktx", name = "core-ktx", version.ref = "coreKtx" }
androidx-lifecycle-runtime-ktx = { group = "androidx.lifecycle.runtime.ktx", name = "lifecycle-runtime-ktx", version.ref = "lifecycleRuntimeKtx" }
androidx-activity-compose = { group = "androidx.activity.compose", name = "activity-compose", version.ref = "activityCompose" }
androidx-compose-bom = { group = "androidx.compose.bom", name = "compose-bom", version.ref = "composeBom" }
androidx-ui = { group = "androidx.compose.ui", name = "ui" }
androidx-material3 = { group = "androidx.compose.material3", name = "material3" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
kotlin-compose = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }
`;

export const EXAMPLE_UNIT_TEST_KT = `package com.example.myapplication

import org.junit.Test
import org.junit.Assert.*

class ExampleUnitTest {
    @Test
    fun addition_isCorrect() {
        assertEquals(4, 2 + 2)
    }
}
`;

export const EXAMPLE_INSTRUMENTED_TEST_KT = `package com.example.myapplication

import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.Assert.*

@RunWith(AndroidJUnit4::class)
class ExampleInstrumentedTest {
    @Test
    fun useAppContext() {
        val appContext = InstrumentationRegistry.getInstrumentation().targetContext
        assertEquals("com.example.myapplication", appContext.packageName)
    }
}
`;

const JETNEWS_HOME_KT = `package com.example.jetnews

import android.util.Log
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview

@Composable
fun JetnewsHomeScreen() {
    Log.i("JetnewsHome", "Rendering top stories feed")
    Column {
        Text(text = "Jetnews — Top Stories")
        Text(text = "Compose Multiplatform Architecture")
        Button(onClick = {}) {
            Text(text = "Read Article")
        }
    }
}

@Preview(showBackground = true)
@Composable
fun JetnewsHomePreview() {
    JetnewsHomeScreen()
}
`;

export const STUDIO_PRESETS: StudioProjectPreset[] = [
  {
    id: "my-application",
    name: "MyApplication",
    monogram: "MA",
    monogramBg: "#C77D55",
    packageName: "com.example.myapplication",
    branch: "main",
    files: [
      {
        id: "main-activity",
        name: "MainActivity",
        tabTitle: "MainActivity.kt",
        path: "app/src/main/java/com/example/myapplication/MainActivity.kt",
        breadcrumbs: ["MyApplication", "app", "src", "main", "java", "com.example.myapplication", "MainActivity.kt"],
        kind: "kotlin",
        hasComposePreview: true,
        content: MAIN_ACTIVITY_KT,
      },
      {
        id: "activity-main-xml",
        name: "activity_main.xml",
        tabTitle: "activity_main.xml",
        path: "app/src/main/res/layout/activity_main.xml",
        breadcrumbs: ["MyApplication", "app", "src", "main", "res", "layout", "activity_main.xml"],
        kind: "xml",
        isLayoutXml: true,
        content: ACTIVITY_MAIN_XML,
      },
      {
        id: "manifest-xml",
        name: "AndroidManifest.xml",
        tabTitle: "AndroidManifest.xml",
        path: "app/src/main/AndroidManifest.xml",
        breadcrumbs: ["MyApplication", "app", "manifests", "AndroidManifest.xml"],
        kind: "manifest",
        content: ANDROID_MANIFEST_XML,
      },
      {
        id: "theme-color-kt",
        name: "Color",
        tabTitle: "Color.kt",
        path: "app/src/main/java/com/example/myapplication/ui/theme/Color.kt",
        breadcrumbs: ["MyApplication", "app", "kotlin+java", "com.example.myapplication", "ui.theme", "Color.kt"],
        kind: "kotlin",
        content: COLOR_KT,
      },
      {
        id: "theme-kt",
        name: "Theme",
        tabTitle: "Theme.kt",
        path: "app/src/main/java/com/example/myapplication/ui/theme/Theme.kt",
        breadcrumbs: ["MyApplication", "app", "kotlin+java", "com.example.myapplication", "ui.theme", "Theme.kt"],
        kind: "kotlin",
        content: THEME_KT,
      },
      {
        id: "strings-xml",
        name: "strings.xml",
        tabTitle: "strings.xml",
        path: "app/src/main/res/values/strings.xml",
        breadcrumbs: ["MyApplication", "app", "res", "values", "strings.xml"],
        kind: "xml",
        content: STRINGS_XML,
      },
      {
        id: "colors-xml",
        name: "colors.xml",
        tabTitle: "colors.xml",
        path: "app/src/main/res/values/colors.xml",
        breadcrumbs: ["MyApplication", "app", "res", "values", "colors.xml"],
        kind: "xml",
        content: COLORS_XML,
      },
      {
        id: "themes-xml",
        name: "themes.xml",
        tabTitle: "themes.xml",
        path: "app/src/main/res/values/themes.xml",
        breadcrumbs: ["MyApplication", "app", "res", "values", "themes.xml"],
        kind: "xml",
        content: THEMES_XML,
      },
      {
        id: "unit-test-kt",
        name: "ExampleUnitTest",
        tabTitle: "ExampleUnitTest.kt",
        path: "app/src/test/java/com/example/myapplication/ExampleUnitTest.kt",
        breadcrumbs: ["MyApplication", "app", "test", "ExampleUnitTest.kt"],
        kind: "kotlin",
        isTest: true,
        content: EXAMPLE_UNIT_TEST_KT,
      },
      {
        id: "instrumented-test-kt",
        name: "ExampleInstrumentedTest",
        tabTitle: "ExampleInstrumentedTest.kt",
        path: "app/src/androidTest/java/com/example/myapplication/ExampleInstrumentedTest.kt",
        breadcrumbs: ["MyApplication", "app", "androidTest", "ExampleInstrumentedTest.kt"],
        kind: "kotlin",
        isTest: true,
        content: EXAMPLE_INSTRUMENTED_TEST_KT,
      },
      {
        id: "gradle-project",
        name: "build.gradle.kts",
        tabTitle: "build.gradle.kts (Project: MyApplication)",
        path: "build.gradle.kts",
        breadcrumbs: ["MyApplication", "Gradle Scripts", "build.gradle.kts (Project: MyApplication)"],
        kind: "gradle-kts",
        androidHint: "(Project: MyApplication)",
        content: BUILD_GRADLE_PROJECT_KTS,
      },
      {
        id: "gradle-module",
        name: "build.gradle.kts",
        tabTitle: "build.gradle.kts (Module :app)",
        path: "app/build.gradle.kts",
        breadcrumbs: ["MyApplication", "Gradle Scripts", "build.gradle.kts (Module :app)"],
        kind: "gradle-kts",
        androidHint: "(Module :app)",
        content: BUILD_GRADLE_MODULE_KTS,
      },
      {
        id: "proguard-rules",
        name: "proguard-rules.pro",
        tabTitle: "proguard-rules.pro",
        path: "app/proguard-rules.pro",
        breadcrumbs: ["MyApplication", "Gradle Scripts", "proguard-rules.pro"],
        kind: "proguard",
        androidHint: "(ProGuard Rules for \":app\")",
        content: "# Add project specific ProGuard rules here.\n-keepattributes *Annotation*\n",
      },
      {
        id: "gradle-properties",
        name: "gradle.properties",
        tabTitle: "gradle.properties",
        path: "gradle.properties",
        breadcrumbs: ["MyApplication", "Gradle Scripts", "gradle.properties"],
        kind: "properties",
        androidHint: "(Project Properties)",
        content: "org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8\nandroid.useAndroidX=true\nkotlin.code.style=official\n",
      },
      {
        id: "gradle-wrapper",
        name: "gradle-wrapper.properties",
        tabTitle: "gradle-wrapper.properties",
        path: "gradle/wrapper/gradle-wrapper.properties",
        breadcrumbs: ["MyApplication", "Gradle Scripts", "gradle-wrapper.properties"],
        kind: "properties",
        androidHint: "(Gradle Version)",
        content: "distributionUrl=https\\://services.gradle.org/distributions/gradle-8.9-bin.zip\n",
      },
      {
        id: "libs-versions",
        name: "libs.versions.toml",
        tabTitle: "libs.versions.toml",
        path: "gradle/libs.versions.toml",
        breadcrumbs: ["MyApplication", "Gradle Scripts", "libs.versions.toml"],
        kind: "toml",
        androidHint: "(Version Catalog \"libs\")",
        content: LIBS_VERSIONS_TOML,
      },
      {
        id: "settings-gradle",
        name: "settings.gradle.kts",
        tabTitle: "settings.gradle.kts",
        path: "settings.gradle.kts",
        breadcrumbs: ["MyApplication", "Gradle Scripts", "settings.gradle.kts"],
        kind: "gradle-kts",
        androidHint: "(Project Settings)",
        content: "rootProject.name = \"MyApplication\"\ninclude(\":app\")\n",
      },
    ],
  },
  {
    id: "jetnews-sample",
    name: "JetNews",
    monogram: "JN",
    monogramBg: "#3574F0",
    packageName: "com.example.jetnews",
    branch: "compose-material3",
    files: [
      {
        id: "main-activity",
        name: "JetnewsHome",
        tabTitle: "JetnewsHome.kt",
        path: "app/src/main/java/com/example/jetnews/JetnewsHome.kt",
        breadcrumbs: ["JetNews", "app", "src", "main", "java", "com.example.jetnews", "JetnewsHome.kt"],
        kind: "kotlin",
        hasComposePreview: true,
        content: JETNEWS_HOME_KT,
      },
      {
        id: "manifest-xml",
        name: "AndroidManifest.xml",
        tabTitle: "AndroidManifest.xml",
        path: "app/src/main/AndroidManifest.xml",
        breadcrumbs: ["JetNews", "app", "manifests", "AndroidManifest.xml"],
        kind: "manifest",
        content: ANDROID_MANIFEST_XML.replace(/com\.example\.myapplication/g, "com.example.jetnews").replace("My Application", "JetNews"),
      },
      {
        id: "strings-xml",
        name: "strings.xml",
        tabTitle: "strings.xml",
        path: "app/src/main/res/values/strings.xml",
        breadcrumbs: ["JetNews", "app", "res", "values", "strings.xml"],
        kind: "xml",
        content: "<resources>\n    <string name=\"app_name\">JetNews</string>\n</resources>\n",
      },
      {
        id: "gradle-module",
        name: "build.gradle.kts",
        tabTitle: "build.gradle.kts (Module :app)",
        path: "app/build.gradle.kts",
        breadcrumbs: ["JetNews", "Gradle Scripts", "build.gradle.kts (Module :app)"],
        kind: "gradle-kts",
        androidHint: "(Module :app)",
        content: BUILD_GRADLE_MODULE_KTS.replace(/com\.example\.myapplication/g, "com.example.jetnews"),
      },
      {
        id: "libs-versions",
        name: "libs.versions.toml",
        tabTitle: "libs.versions.toml",
        path: "gradle/libs.versions.toml",
        breadcrumbs: ["JetNews", "Gradle Scripts", "libs.versions.toml"],
        kind: "toml",
        androidHint: "(Version Catalog \"libs\")",
        content: LIBS_VERSIONS_TOML,
      },
    ],
  },
];

export function buildAndroidProjectTree(preset: StudioProjectPreset, viewMode: AndroidViewMode): AndroidTreeNode[] {
  const byId = new Map<string, StudioFile>();
  preset.files.forEach((f) => byId.set(f.id, f));

  if (viewMode === "Packages") {
    const pkgFiles = preset.files.filter((f) => f.kind === "kotlin");
    return [
      {
        id: "pkg-root",
        label: preset.packageName,
        kind: "package",
        children: pkgFiles.map((f) => ({
          id: "pkg-node-" + f.id,
          label: f.name,
          kind: "file" as const,
          fileId: f.id,
          fileKind: f.kind,
          isTest: f.isTest,
        })),
      },
    ];
  }

  if (viewMode === "Project") {
    return [
      {
        id: "proj-root",
        label: preset.name,
        hint: "~/AndroidStudioProjects/" + preset.name,
        kind: "folder",
        children: [
          {
            id: "proj-app",
            label: "app",
            kind: "module",
            children: preset.files
              .filter((f) => f.path.indexOf("app/") === 0)
              .map((f) => ({
                id: "proj-f-" + f.id,
                label: f.tabTitle,
                kind: "file" as const,
                fileId: f.id,
                fileKind: f.kind,
                isTest: f.isTest,
              })),
          },
          {
            id: "proj-gradle",
            label: "gradle",
            kind: "folder",
            children: preset.files
              .filter((f) => f.path.indexOf("gradle") === 0 || f.path.indexOf("build.") === 0 || f.path.indexOf("settings.") === 0)
              .map((f) => ({
                id: "proj-g-" + f.id,
                label: f.tabTitle,
                kind: "file" as const,
                fileId: f.id,
                fileKind: f.kind,
              })),
          },
        ],
      },
    ];
  }

  // Exact "Android" View hierarchy matching official New UI screenshots
  const kotlinSrcChildren: AndroidTreeNode[] = [];
  const mainActivity = byId.get("main-activity");
  if (mainActivity) {
    kotlinSrcChildren.push({
      id: "node-main-activity",
      label: mainActivity.name,
      kind: "file",
      fileId: mainActivity.id,
      fileKind: "kotlin",
    });
  }
  const themeKids: AndroidTreeNode[] = [];
  const cKt = byId.get("theme-color-kt");
  const tKt = byId.get("theme-kt");
  if (cKt) {
    themeKids.push({ id: "node-color-kt", label: cKt.name, kind: "file", fileId: cKt.id, fileKind: "kotlin" });
  }
  if (tKt) {
    themeKids.push({ id: "node-theme-kt", label: tKt.name, kind: "file", fileId: tKt.id, fileKind: "kotlin" });
  }
  if (themeKids.length > 0) {
    kotlinSrcChildren.push({
      id: "node-ui-theme",
      label: "ui.theme",
      kind: "package",
      children: themeKids,
    });
  }

  const kotlinPackages: AndroidTreeNode[] = [
    {
      id: "node-pkg-main",
      label: preset.packageName,
      kind: "package",
      children: kotlinSrcChildren,
    },
  ];
  const androidTest = byId.get("instrumented-test-kt");
  if (androidTest) {
    kotlinPackages.push({
      id: "node-pkg-android-test",
      label: preset.packageName + " (androidTest)",
      kind: "package",
      isTest: true,
      children: [
        {
          id: "node-instr-test",
          label: androidTest.name,
          kind: "file",
          fileId: androidTest.id,
          fileKind: "kotlin",
          isTest: true,
        },
      ],
    });
  }
  const unitTest = byId.get("unit-test-kt");
  if (unitTest) {
    kotlinPackages.push({
      id: "node-pkg-unit-test",
      label: preset.packageName + " (test)",
      kind: "package",
      isTest: true,
      children: [
        {
          id: "node-unit-test",
          label: unitTest.name,
          kind: "file",
          fileId: unitTest.id,
          fileKind: "kotlin",
          isTest: true,
        },
      ],
    });
  }

  const valuesKids: AndroidTreeNode[] = [];
  ["colors-xml", "strings-xml", "themes-xml"].forEach((vid) => {
    const vf = byId.get(vid);
    if (vf) {
      valuesKids.push({
        id: "node-" + vf.id,
        label: vf.name,
        kind: "file",
        fileId: vf.id,
        fileKind: "xml",
      });
    }
  });

  const resChildren: AndroidTreeNode[] = [
    { id: "node-res-drawable", label: "drawable", kind: "folder", children: [] },
  ];
  const layoutXml = byId.get("activity-main-xml");
  if (layoutXml) {
    resChildren.push({
      id: "node-res-layout",
      label: "layout",
      kind: "folder",
      children: [
        {
          id: "node-activity-main",
          label: layoutXml.name,
          kind: "file",
          fileId: layoutXml.id,
          fileKind: "xml",
        },
      ],
    });
  }
  resChildren.push({ id: "node-res-mipmap", label: "mipmap", kind: "folder", children: [] });
  if (valuesKids.length > 0) {
    resChildren.push({
      id: "node-res-values",
      label: "values",
      kind: "folder",
      children: valuesKids,
    });
  }

  const gradleIds = [
    "gradle-project",
    "gradle-module",
    "proguard-rules",
    "gradle-properties",
    "gradle-wrapper",
    "libs-versions",
    "settings-gradle",
  ];
  const gradleChildren: AndroidTreeNode[] = [];
  gradleIds.forEach((gid) => {
    const gf = byId.get(gid);
    if (gf) {
      gradleChildren.push({
        id: "node-" + gf.id,
        label: gf.name,
        hint: gf.androidHint,
        kind: "file",
        fileId: gf.id,
        fileKind: gf.kind,
      });
    }
  });

  const manifestFile = byId.get("manifest-xml");
  const appChildren: AndroidTreeNode[] = [];
  if (manifestFile) {
    appChildren.push({
      id: "node-manifests",
      label: "manifests",
      kind: "source-root",
      children: [
        {
          id: "node-manifest-xml",
          label: "AndroidManifest.xml",
          kind: "file",
          fileId: manifestFile.id,
          fileKind: "manifest",
        },
      ],
    });
  }
  appChildren.push({
    id: "node-kotlin-java",
    label: "kotlin+java",
    kind: "source-root",
    children: kotlinPackages,
  });
  appChildren.push({
    id: "node-res",
    label: "res",
    kind: "resources-root",
    children: resChildren,
  });

  return [
    {
      id: "node-app",
      label: "app",
      kind: "module",
      children: appChildren,
    },
    {
      id: "node-gradle-scripts",
      label: "Gradle Scripts",
      kind: "gradle-root",
      children: gradleChildren,
    },
  ];
}

export function getLogcatTagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % LOGCAT_TAG_PALETTE.length;
  return LOGCAT_TAG_PALETTE[idx];
}

export function createInitialLogcatEntries(packageName: string): LogcatEntry[] {
  return [
    {
      id: "log-1",
      timestamp: "2026-11-15 22:42:10.114",
      pid: 4820,
      tid: 4820,
      tag: "ActivityTaskManager",
      packageName: "system_process",
      level: "I",
      message: `START u0 {act=android.intent.action.MAIN cat=[android.intent.category.LAUNCHER] cmp=${packageName}/.MainActivity} with LAUNCH_MULTIPLE from uid 10189`,
    },
    {
      id: "log-2",
      timestamp: "2026-11-15 22:42:10.302",
      pid: 6142,
      tid: 6142,
      tag: "CompatibilityChange",
      packageName,
      level: "D",
      message: "Compat change id reported: 171979766; UID 10194; state: ENABLED",
    },
    {
      id: "log-3",
      timestamp: "2026-11-15 22:42:10.489",
      pid: 6142,
      tid: 6142,
      tag: "MainActivity",
      packageName,
      level: "I",
      message: "onCreate: initialized Compose content",
    },
    {
      id: "log-4",
      timestamp: "2026-11-15 22:42:10.618",
      pid: 6142,
      tid: 6171,
      tag: "HWUI",
      packageName,
      level: "D",
      message: "RenderThread Vulkan pipeline warmed up (Medium Phone API 35)",
    },
    {
      id: "log-5",
      timestamp: "2026-11-15 22:42:10.745",
      pid: 6142,
      tid: 6142,
      tag: "Choreographer",
      packageName,
      level: "I",
      message: "Displayed com.example.myapplication/.MainActivity for user 0: +631ms",
    },
    {
      id: "log-6",
      timestamp: "2026-11-15 22:42:11.012",
      pid: 6142,
      tid: 6155,
      tag: "ProfileInstaller",
      packageName,
      level: "V",
      message: "Installing profile for " + packageName,
    },
  ];
}

const LEVEL_RANK: Record<LogcatLevel, number> = {
  V: 0,
  D: 1,
  I: 2,
  W: 3,
  E: 4,
  A: 5,
};

function normalizeLevelToken(raw: string): LogcatLevel | null {
  const upper = raw.trim().toUpperCase();
  if (upper === "V" || upper === "VERBOSE") return "V";
  if (upper === "D" || upper === "DEBUG") return "D";
  if (upper === "I" || upper === "INFO") return "I";
  if (upper === "W" || upper === "WARN" || upper === "WARNING") return "W";
  if (upper === "E" || upper === "ERROR") return "E";
  if (upper === "A" || upper === "ASSERT") return "A";
  return null;
}

export function filterLogcatEntries(
  entries: LogcatEntry[],
  query: string,
  activePackageName: string
): LogcatEntry[] {
  const trimmed = query.trim();
  if (!trimmed) return entries;

  const tokens = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  return entries.filter((entry) => {
    for (let i = 0; i < tokens.length; i++) {
      let token = tokens[i];
      const negated = token.charAt(0) === "-";
      if (negated) {
        token = token.slice(1);
      }
      const colonIdx = token.indexOf(":");
      let matched = true;

      if (colonIdx > 0) {
        const key = token.slice(0, colonIdx).toLowerCase();
        const rawVal = token.slice(colonIdx + 1).replace(/^"|"$/g, "");
        const val = rawVal.toLowerCase();

        if (key === "package") {
          if (val === "mine") {
            matched = entry.packageName === activePackageName;
          } else {
            matched = entry.packageName.toLowerCase().indexOf(val) >= 0;
          }
        } else if (key === "package~") {
          try {
            matched = new RegExp(rawVal, "i").test(entry.packageName);
          } catch {
            matched = false;
          }
        } else if (key === "tag") {
          matched = entry.tag.toLowerCase().indexOf(val) >= 0;
        } else if (key === "tag~") {
          try {
            matched = new RegExp(rawVal, "i").test(entry.tag);
          } catch {
            matched = false;
          }
        } else if (key === "level") {
          const minRank = normalizeLevelToken(val);
          if (minRank) {
            matched = LEVEL_RANK[entry.level] >= LEVEL_RANK[minRank];
          }
        } else if (key === "message") {
          matched = entry.message.toLowerCase().indexOf(val) >= 0;
        } else if (key === "message~") {
          try {
            matched = new RegExp(rawVal, "i").test(entry.message);
          } catch {
            matched = false;
          }
        } else if (key === "is") {
          if (val === "crash" || val === "stacktrace") {
            matched = Boolean(entry.isCrash) || entry.level === "E" || entry.level === "A";
          }
        }
      } else {
        const needle = token.replace(/^"|"$/g, "").toLowerCase();
        matched =
          entry.message.toLowerCase().indexOf(needle) >= 0 ||
          entry.tag.toLowerCase().indexOf(needle) >= 0 ||
          entry.packageName.toLowerCase().indexOf(needle) >= 0;
      }

      if (negated ? matched : !matched) {
        return false;
      }
    }
    return true;
  });
}

function countBraces(line: string): number {
  let delta = 0;
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i);
    if (ch === "\\" && (inSingle || inDouble)) {
      i++;
      continue;
    }
    if (!inSingle && ch === "\"") inDouble = !inDouble;
    else if (!inDouble && ch === "'") inSingle = !inSingle;
    else if (!inSingle && !inDouble) {
      if (ch === "{") delta++;
      else if (ch === "}") delta--;
    }
  }
  return delta;
}

export function analyzeStudioProblems(files: StudioFile[]): StudioProblem[] {
  const problems: StudioProblem[] = [];

  files.forEach((file) => {
    const lines = file.content.split(/\r?\n/);
    if (file.kind === "kotlin" || file.kind === "gradle-kts") {
      let braceBalance = 0;
      let firstOpenLine = 1;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const stripped = line.replace(/\/\/.*$/, "");
        if (stripped.indexOf("{") >= 0 && braceBalance === 0) {
          firstOpenLine = i + 1;
        }
        braceBalance += countBraces(stripped);
        if (braceBalance < 0) {
          problems.push({
            id: `${file.id}-brace-${i + 1}`,
            fileId: file.id,
            fileName: file.tabTitle,
            line: i + 1,
            column: Math.max(1, line.indexOf("}") + 1),
            severity: "error",
            message: "Unexpected '}'",
          });
          braceBalance = 0;
        }
        if (/\bTODO\b/i.test(line)) {
          problems.push({
            id: `${file.id}-todo-${i + 1}`,
            fileId: file.id,
            fileName: file.tabTitle,
            line: i + 1,
            column: line.indexOf("TODO") + 1,
            severity: "info",
            message: line.trim(),
          });
        }
      }
      if (braceBalance > 0) {
        problems.push({
          id: `${file.id}-unclosed-brace`,
          fileId: file.id,
          fileName: file.tabTitle,
          line: Math.max(firstOpenLine, lines.length),
          column: 1,
          severity: "error",
          message: "Expecting '}' — missing " + braceBalance + " closing brace(s)",
        });
      }
    } else if (file.kind === "xml" || file.kind === "manifest") {
      const stack: Array<{ tag: string; line: number }> = [];
      const cleanedXml = file.content.replace(/<!--[\s\S]*?-->/g, "");
      const tokenRegex = /<\/?([A-Za-z0-9_.:-]+)(?:\s+[\s\S]*?)?(\/?)>/g;
      let match: RegExpExecArray | null = tokenRegex.exec(cleanedXml);
      while (match) {
        const fullToken = match[0];
        const tagName = match[1];
        const selfClosing = match[2] === "/";
        const lineNum = file.content.slice(0, match.index).split(/\r?\n/).length;

        if (fullToken.indexOf("<?") === 0 || fullToken.indexOf("<!") === 0 || selfClosing) {
          // declaration or self-closing tag (<TextView ... />)
        } else if (fullToken.indexOf("</") === 0) {
          if (stack.length === 0) {
            problems.push({
              id: `${file.id}-xml-extra-${lineNum}`,
              fileId: file.id,
              fileName: file.tabTitle,
              line: lineNum,
              column: 1,
              severity: "error",
              message: `Unexpected closing tag </${tagName}>`,
            });
          } else {
            const top = stack[stack.length - 1];
            if (top.tag !== tagName) {
              problems.push({
                id: `${file.id}-xml-mismatch-${lineNum}`,
                fileId: file.id,
                fileName: file.tabTitle,
                line: lineNum,
                column: 1,
                severity: "error",
                message: `Mismatched XML tag: expected </${top.tag}>, found </${tagName}>`,
              });
            }
            stack.pop();
          }
        } else {
          stack.push({ tag: tagName, line: lineNum });
        }
        match = tokenRegex.exec(cleanedXml);
      }
      if (stack.length > 0) {
        const unclosed = stack[stack.length - 1];
        problems.push({
          id: `${file.id}-xml-unclosed`,
          fileId: file.id,
          fileName: file.tabTitle,
          line: unclosed.line,
          column: 1,
          severity: "error",
          message: `Unclosed XML element <${unclosed.tag}>`,
        });
      }
    }
  });

  return problems;
}

function parseStringsMap(files: StudioFile[]): Record<string, string> {
  const map: Record<string, string> = {};
  const stringsFile = files.find((f) => f.id === "strings-xml" || f.name === "strings.xml");
  if (!stringsFile) return map;
  const regex = /<string\s+name="([^"]+)">([\s\S]*?)<\/string>/g;
  let m: RegExpExecArray | null = regex.exec(stringsFile.content);
  while (m) {
    map[m[1]] = m[2].trim();
    m = regex.exec(stringsFile.content);
  }
  return map;
}

function resolveAndroidValue(raw: string, stringsMap: Record<string, string>, vars: Record<string, string>): string {
  let v = raw.trim().replace(/^"(.*)"$/, "$1");
  if (v.indexOf("@string/") === 0) {
    const key = v.slice("@string/".length);
    if (stringsMap[key] !== undefined) return stringsMap[key];
  }
  Object.keys(vars).forEach((k) => {
    v = v.split("$" + k).join(vars[k]);
    v = v.split("${" + k + "}").join(vars[k]);
  });
  return v;
}

export function extractPreviewTree(
  files: StudioFile[],
  activeFileId: string,
  clickCount: number
): PreviewWidgetNode {
  const stringsMap = parseStringsMap(files);
  const activeFile = files.find((f) => f.id === activeFileId) || files[0];
  const xmlFile = files.find((f) => f.id === "activity-main-xml" || f.isLayoutXml);

  if (activeFile && activeFile.isLayoutXml) {
    return parseXmlLayoutPreview(activeFile.content, stringsMap);
  }

  const ktFile =
    (activeFile && activeFile.kind === "kotlin" ? activeFile : undefined) ||
    files.find((f) => f.id === "main-activity") ||
    files.find((f) => f.kind === "kotlin");

  if (ktFile) {
    const vars: Record<string, string> = {
      clicks: String(clickCount),
      name: "Android",
    };

    // Check Greeting("...") invocation in Preview or setContent
    const previewCall = /Greeting\s*\(\s*(?:name\s*=\s*)?"([^"]+)"/.exec(ktFile.content);
    if (previewCall) {
      vars.name = previewCall[1];
    }

    const valMatches = ktFile.content.match(/val\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"([^"]*)"/g) || [];
    valMatches.forEach((stmt) => {
      const m = /val\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"([^"]*)"/.exec(stmt);
      if (m) vars[m[1]] = m[2];
    });

    const widgets: PreviewWidgetNode[] = [];
    const textRegex = /Text\s*\(\s*(?:text\s*=\s*)?"([^"]*)"/g;
    let tm = textRegex.exec(ktFile.content);
    let idx = 0;
    while (tm) {
      const resolved = resolveAndroidValue(tm[1], stringsMap, vars);
      widgets.push({
        id: "compose-text-" + idx,
        type: "Text",
        text: resolved,
        fontSize: idx === 0 ? 20 : 14,
        fontWeight: idx === 0 ? "semibold" : "normal",
        children: [],
      });
      idx++;
      tm = textRegex.exec(ktFile.content);
    }

    const hasButton = /\bButton\s*\(/.test(ktFile.content);
    if (hasButton) {
      // Find first Text after Button( to style as Button label rather than standalone text
      const buttonBlock = /Button\s*\([^)]*\)\s*\{([\s\S]*?)\}/.exec(ktFile.content);
      const btnTextMatch = buttonBlock ? /Text\s*\(\s*(?:text\s*=\s*)?"([^"]*)"/.exec(buttonBlock[1]) : null;
      const btnLabel = btnTextMatch
        ? resolveAndroidValue(btnTextMatch[1], stringsMap, vars)
        : `Clicked ${clickCount} times`;

      // Deduplicate trailing button Text already captured cleanly
      const filteredTexts = widgets.filter((w, wIdx) => !(btnTextMatch && wIdx === widgets.length - 1 && w.text === btnLabel));
      filteredTexts.push({
        id: "compose-btn-0",
        type: "Button",
        text: btnLabel,
        onClickAction: "increment_clicks",
        children: [],
      });
      return {
        id: "compose-root",
        type: "Column",
        modifierLabel: "Modifier.fillMaxSize()",
        children: filteredTexts,
      };
    }

    if (widgets.length > 0) {
      return {
        id: "compose-root",
        type: "Column",
        modifierLabel: "Modifier.fillMaxSize()",
        children: widgets,
      };
    }
  }

  if (xmlFile) {
    return parseXmlLayoutPreview(xmlFile.content, stringsMap);
  }

  return {
    id: "fallback-root",
    type: "Column",
    children: [
      { id: "fallback-text", type: "Text", text: "Hello Android!", fontSize: 20, fontWeight: "semibold", children: [] },
    ],
  };
}

export function parseXmlLayoutPreview(xmlSource: string, stringsMap: Record<string, string> = {}): PreviewWidgetNode {
  const children: PreviewWidgetNode[] = [];
  const tagRegex = /<(TextView|Button|EditText|Switch)\b([\s\S]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g;
  let m = tagRegex.exec(xmlSource);
  let idx = 0;
  while (m) {
    const tag = m[1];
    const attrs = m[2];
    const idMatch = /android:id="@\+?id\/([^"]+)"/.exec(attrs);
    const textMatch = /android:text="([^"]*)"/.exec(attrs);
    const sizeMatch = /android:textSize="(\d+)(?:sp|dp)"/.exec(attrs);
    const resolvedText = textMatch ? resolveAndroidValue(textMatch[1], stringsMap, {}) : tag;

    children.push({
      id: idMatch ? idMatch[1] : `xml-node-${idx}`,
      type: tag === "Button" ? "Button" : tag === "Switch" ? "Switch" : tag === "EditText" ? "TextField" : "TextView",
      text: resolvedText,
      fontSize: sizeMatch ? Number(sizeMatch[1]) : tag === "TextView" ? 18 : 14,
      onClickAction: tag === "Button" ? "xml_button_tap" : undefined,
      children: [],
    });
    idx++;
    m = tagRegex.exec(xmlSource);
  }

  const rootType = /LinearLayout/.test(xmlSource) ? "LinearLayout" : "ConstraintLayout";
  return {
    id: "xml-root",
    type: rootType,
    children:
      children.length > 0
        ? children
        : [{ id: "empty-xml", type: "TextView", text: "Hello World!", fontSize: 18, children: [] }],
  };
}

function evalKotlinSimpleExpr(expr: string, env: Record<string, string | number>): string {
  const trimmed = expr.trim();
  if (trimmed.indexOf("\"") === 0 && trimmed.lastIndexOf("\"") === trimmed.length - 1) {
    const raw = trimmed.slice(1, -1);
    return raw.replace(/\$\{([^}]+)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (_all, braced: string, simple: string) => {
      const key = braced || simple;
      if (env[key] !== undefined) return String(env[key]);
      if (braced && /^[0-9+\-*/\s().]+$/.test(braced)) {
        try {
          const val = Function(`"use strict"; return (${braced});`)();
          return String(val);
        } catch {
          return "";
        }
      }
      return "";
    });
  }
  if (trimmed.indexOf("+") >= 0) {
    const parts = trimmed.split("+");
    let acc = "";
    for (let i = 0; i < parts.length; i++) {
      acc += evalKotlinSimpleExpr(parts[i], env);
    }
    return acc;
  }
  if (env[trimmed] !== undefined) return String(env[trimmed]);
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed;
  return trimmed.replace(/^"|"$/g, "");
}

export function runAndroidApp(
  files: StudioFile[],
  activeFileId: string,
  device: StudioDeviceProfile,
  clickCount: number
): AndroidRunResult {
  const start = Date.now();
  const problems = analyzeStudioProblems(files);
  const errors = problems.filter((p) => p.severity === "error");

  const previewTree = extractPreviewTree(files, activeFileId, clickCount);

  if (errors.length > 0) {
    const buildSteps: GradleBuildStep[] = [
      { id: "step-cfg", label: "Configure project :app", status: "up-to-date", durationMs: 42 },
      { id: "step-res", label: ":app:mergeDebugResources", status: "up-to-date", durationMs: 65 },
      {
        id: "step-kt",
        label: ":app:compileDebugKotlin FAILED",
        status: "failed",
        durationMs: 120,
        detail: `${errors[0].fileName}:${errors[0].line}:${errors[0].column}: e: ${errors[0].message}`,
      },
    ];
    return {
      success: false,
      stdout: errors.map((e) => `e: ${e.fileName}:${e.line}:${e.column}: ${e.message}`),
      errors,
      buildSteps,
      previewTree,
      logcatEmitted: [
        {
          id: "err-log-" + Date.now(),
          timestamp: "2026-11-15 22:45:12.104",
          pid: 6204,
          tid: 6204,
          tag: "GradleBuild",
          packageName: "com.example.myapplication",
          level: "E",
          message: `Build failed in ${errors[0].fileName} (line ${errors[0].line}): ${errors[0].message}`,
        },
      ],
      durationMs: Math.max(12, Date.now() - start),
    };
  }

  const stdout: string[] = [];
  const emittedLogs: LogcatEntry[] = [];
  const ktFile =
    files.find((f) => f.id === activeFileId && f.kind === "kotlin") ||
    files.find((f) => f.id === "main-activity") ||
    files[0];

  const pkgMatch = ktFile ? /package\s+([A-Za-z0-9_.]+)/.exec(ktFile.content) : null;
  const packageName = pkgMatch ? pkgMatch[1] : "com.example.myapplication";
  const env: Record<string, string | number> = { clicks: clickCount, name: "Android" };

  if (ktFile) {
    const lines = ktFile.content.split(/\r?\n/);
    lines.forEach((line, idx) => {
      const varMatch = /\b(?:val|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([^\n]+)$/.exec(line);
      if (varMatch && varMatch[2].indexOf("remember") < 0 && varMatch[2].indexOf("mutableStateOf") < 0) {
        env[varMatch[1]] = evalKotlinSimpleExpr(varMatch[2], env);
      }
      const printMatch = /\bprintln\s*\(([^)]+)\)/.exec(line);
      if (printMatch) {
        const rendered = evalKotlinSimpleExpr(printMatch[1], env);
        stdout.push(rendered);
        emittedLogs.push({
          id: `run-stdout-${idx}-${Date.now()}`,
          timestamp: "2026-11-15 22:45:14.220",
          pid: 6410,
          tid: 6410,
          tag: "System.out",
          packageName,
          level: "I",
          message: rendered,
        });
      }
      const logMatch = /\bLog\.(v|d|i|w|e|wtf)\s*\(\s*"([^"]+)"\s*,\s*([^)]+)\)/.exec(line);
      if (logMatch) {
        const levelChar = logMatch[1].toUpperCase();
        const level: LogcatLevel =
          levelChar === "WTF" ? "A" : (levelChar as LogcatLevel);
        const msg = evalKotlinSimpleExpr(logMatch[3], env);
        emittedLogs.push({
          id: `run-log-${idx}-${Date.now()}`,
          timestamp: "2026-11-15 22:45:14.310",
          pid: 6410,
          tid: 6410,
          tag: logMatch[2],
          packageName,
          level,
          message: msg,
        });
      }
    });
  }

  emittedLogs.push({
    id: "run-launch-" + Date.now(),
    timestamp: "2026-11-15 22:45:14.540",
    pid: 6410,
    tid: 6410,
    tag: "ActivityTaskManager",
    packageName: "system_process",
    level: "I",
    message: `Displayed ${packageName}/.MainActivity on ${device.name} (${device.adbSerial}): +318ms`,
  });

  const buildSteps: GradleBuildStep[] = [
    { id: "step-cfg", label: "Configure project :app", status: "up-to-date", durationMs: 38 },
    { id: "step-pre", label: ":app:preBuild", status: "up-to-date", durationMs: 8 },
    { id: "step-res", label: ":app:mergeDebugResources", status: "success", durationMs: 112 },
    { id: "step-kt", label: ":app:compileDebugKotlin", status: "success", durationMs: 420 },
    { id: "step-dex", label: ":app:dexBuilderDebug", status: "success", durationMs: 145 },
    { id: "step-pkg", label: ":app:packageDebug", status: "success", durationMs: 95 },
    {
      id: "step-install",
      label: `:app:installDebug (${device.name})`,
      status: "success",
      durationMs: 210,
    },
  ];

  const runBanner = [
    `$ adb -s ${device.adbSerial} shell am start -n "${packageName}/${packageName}.MainActivity" -a android.intent.action.MAIN -c android.intent.category.LAUNCHER`,
    `Connected to process 6410 on device '${device.name}'.`,
    ...stdout,
    `Launched app '${packageName}' cleanly.`,
  ];

  return {
    success: true,
    stdout: runBanner,
    errors: [],
    buildSteps,
    previewTree,
    logcatEmitted: emittedLogs,
    durationMs: Math.max(24, Date.now() - start),
  };
}

export function executeStudioTerminal(
  cmd: string,
  preset: StudioProjectPreset,
  devices: StudioDeviceProfile[]
): TerminalExecResult {
  const trimmed = cmd.trim();
  if (!trimmed) return { lines: [] };
  const lower = trimmed.toLowerCase();

  if (lower === "clear" || lower === "cls") {
    return { lines: [], clear: true };
  }
  if (lower === "pwd") {
    return { lines: [`/Users/developer/AndroidStudioProjects/${preset.name}`] };
  }
  if (lower === "ls" || lower === "dir") {
    return { lines: ["app/    build.gradle.kts    gradle/    gradle.properties    gradlew*    gradlew.bat    settings.gradle.kts"] };
  }
  if (lower === "git status") {
    return {
      lines: [
        `On branch ${preset.branch}`,
        "Your branch is up to date with 'origin/" + preset.branch + "'.",
        "nothing to commit, working tree clean",
      ],
    };
  }
  if (lower === "adb devices") {
    const active = devices.filter((d) => d.booted);
    const rows = ["List of devices attached"];
    active.forEach((d) => {
      rows.push(`${d.adbSerial}\tdevice`);
    });
    if (active.length === 0) {
      rows.push("(no running emulators — start one from Device Manager)");
    }
    return { lines: rows };
  }
  if (lower === "./gradlew assembledebug" || lower === "gradlew assembledebug") {
    return {
      lines: [
        "> Task :app:preBuild UP-TO-DATE",
        "> Task :app:compileDebugKotlin",
        "> Task :app:packageDebug",
        "> Task :app:assembleDebug",
        "",
        "BUILD SUCCESSFUL in 1s",
        "28 actionable tasks: 3 executed, 25 up-to-date",
      ],
    };
  }
  if (lower === "./gradlew test" || lower === "gradlew test") {
    return {
      lines: [
        "> Task :app:compileDebugUnitTestKotlin",
        "> Task :app:testDebugUnitTest",
        "ExampleUnitTest > addition_isCorrect PASSED",
        "",
        "BUILD SUCCESSFUL in 840ms",
      ],
    };
  }
  if (lower === "help") {
    return {
      lines: [
        "Available commands: pwd, ls, git status, adb devices, ./gradlew assembleDebug, ./gradlew test, clear",
      ],
    };
  }
  return {
    lines: [`zsh: command output ready for '${trimmed}' (try 'help', 'adb devices', './gradlew assembleDebug')`],
  };
}
