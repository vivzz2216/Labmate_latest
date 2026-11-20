// Pure TypeScript engine for Google Android Studio clone.
// Zero "@/" path aliases and ES5-iteration-safe so both Next.js and Node --experimental-strip-types run cleanly.

import { parseAndroidLayoutXml, parseAndroidResources } from "./androidXmlLayout.ts";

export type AndroidViewMode = "Android" | "Project" | "Packages";
export type EditorSplitMode = "Code" | "Split" | "Design";
export type DesignSurfaceMode = "Design" | "Blueprint" | "Both";
export type LogcatLevel = "V" | "D" | "I" | "W" | "E" | "A";
export type StudioFileKind =
  | "java"
  | "kotlin"
  | "xml"
  | "manifest"
  | "gradle"
  | "gradle-kts"
  | "toml"
  | "properties"
  | "proguard"
  | "svg"
  | "text";

export type AndroidProjectTemplate =
  | "two-activity-java"
  | "empty-views-java"
  | "calculator-java"
  | "empty-views-kotlin"
  | "compose-kotlin";

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
  language?: "java" | "kotlin";
  template?: AndroidProjectTemplate;
  folders?: string[];
  isCustom?: boolean;
  snapshotFiles?: StudioFile[];
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
  folderPath?: string;
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

export interface NewProjectOptions {
  appName: string;
  packageName: string;
  template: AndroidProjectTemplate;
  minSdk?: number;
}

function makeMonogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  const caps = name.replace(/[^A-Z]/g, "");
  if (caps.length >= 2) return caps.slice(0, 2);
  return name.slice(0, 2).toUpperCase() || "AP";
}

function buildJavaGroovyModuleGradle(pkg: string, minSdk: number): string {
  return `plugins {
    id 'com.android.application'
}

android {
    namespace '${pkg}'
    compileSdk 35

    defaultConfig {
        applicationId "${pkg}"
        minSdk ${minSdk}
        targetSdk 35
        versionCode 1
        versionName "1.0"
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            minifyEnabled false
        }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.7.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.2.0'
    testImplementation 'junit:junit:4.13.2'
}
`;
}

function buildJavaGroovyRootGradle(): string {
  return `// Top-level build file where you can add configuration options common to all sub-projects/modules.
plugins {
    id 'com.android.application' version '8.7.2' apply false
}
`;
}

function buildIcLauncherDrawable(accentHex: string): string {
  return `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="${accentHex}"
        android:pathData="M31,63.928c0,0 6.4,-11 12.1,-13.1c7.2,-2.6 26,-1.4 26,-1.4l38.1,38.1L107,108.928l-32,-1L31,63.928z" />
</vector>
`;
}

export function createNewAndroidProject(opts: NewProjectOptions): StudioProjectPreset {
  const cleanName = opts.appName.trim() || "My Application";
  const projectFolderName = cleanName.replace(/\s+/g, "");
  const pkg = /^[a-zA-Z_]\w*(\.[a-zA-Z_]\w*)+$/.test(opts.packageName.trim())
    ? opts.packageName.trim()
    : "com.example.myapp";
  const pkgPath = pkg.replace(/\./g, "/");
  const minSdk = opts.minSdk || 24;
  const idSlug = projectFolderName.toLowerCase() + "-" + Math.random().toString(36).slice(2, 6);

  const colorsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="primary">#3574F0</color>
    <color name="primary_dark">#1D4ED8</color>
    <color name="accent">#3DDC84</color>
    <color name="black">#1C1B1F</color>
    <color name="white">#FFFFFF</color>
</resources>
`;

  const stringsXml = `<resources>
    <string name="app_name">${cleanName}</string>
    <string name="welcome_title">${cleanName}</string>
</resources>
`;

  const icForeground = buildIcLauncherDrawable("#3DDC84");
  const icMipmap = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/primary" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>
`;

  const files: StudioFile[] = [];

  if (opts.template === "two-activity-java") {
    const manifestXml = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${pkg}">

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:theme="@style/Theme.MyApplication">
        <activity
            android:name=".SecondActivity"
            android:exported="false" />
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`;

    const mainJava = `package ${pkg};

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private int greetCount = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        Log.i("MainActivity", "onCreate: initialized ${cleanName}");

        EditText etName = findViewById(R.id.etName);
        TextView tvStatus = findViewById(R.id.tvStatus);
        Button btnGreet = findViewById(R.id.btnGreet);
        Button btnOpenDetails = findViewById(R.id.btnOpenDetails);

        btnGreet.setOnClickListener(v -> {
            String name = etName.getText().toString().trim();
            if (name.isEmpty()) {
                Toast.makeText(MainActivity.this, "Please enter your name first", Toast.LENGTH_SHORT).show();
                Log.w("MainActivity", "Empty name submitted");
                return;
            }
            greetCount++;
            String greeting = "Hello, " + name + "! (" + greetCount + ")";
            tvStatus.setText(greeting);
            Log.d("MainActivity", "Updated greeting for " + name);
            Toast.makeText(MainActivity.this, greeting, Toast.LENGTH_SHORT).show();
        });

        btnOpenDetails.setOnClickListener(v -> {
            String name = etName.getText().toString().trim();
            if (name.isEmpty()) {
                name = "Lab Student";
            }
            Intent intent = new Intent(MainActivity.this, SecondActivity.class);
            intent.putExtra("student_name", name);
            intent.putExtra("greet_count", String.valueOf(greetCount));
            Log.i("MainActivity", "Starting SecondActivity via explicit Intent");
            startActivity(intent);
        });
    }
}
`;

    const secondJava = `package ${pkg};

import android.os.Bundle;
import android.util.Log;
import android.widget.Button;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;

public class SecondActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_second);

        TextView tvSummary = findViewById(R.id.tvSummary);
        Button btnBack = findViewById(R.id.btnBack);

        String name = getIntent().getStringExtra("student_name");
        String count = getIntent().getStringExtra("greet_count");
        if (name == null || name.isEmpty()) {
            name = "Guest";
        }
        tvSummary.setText("Welcome to SecondActivity, " + name + "! Greetings sent: " + count);
        Log.i("SecondActivity", "Received Intent extra student_name=" + name);

        btnBack.setOnClickListener(v -> {
            Log.d("SecondActivity", "Finishing SecondActivity");
            finish();
        });
    }
}
`;

    const mainXml = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/main"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="16dp">

    <ImageView
        android:id="@+id/ivLogo"
        android:layout_width="48dp"
        android:layout_height="48dp"
        android:src="@drawable/ic_launcher_foreground"
        android:contentDescription="App Logo" />

    <TextView
        android:id="@+id/tvTitle"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="@string/app_name"
        android:textSize="20sp"
        android:textColor="#1C1B1F" />

    <EditText
        android:id="@+id/etName"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:hint="Enter student name"
        android:inputType="textPersonName" />

    <TextView
        android:id="@+id/tvStatus"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Ready for interaction"
        android:textSize="14sp"
        android:textColor="#49454F" />

    <Button
        android:id="@+id/btnGreet"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Show Greeting" />

    <Button
        android:id="@+id/btnOpenDetails"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Open Second Activity" />

</LinearLayout>
`;

    const secondXml = `<?xml version="1.0" encoding="utf-8"?>
<RelativeLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/secondRoot"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:padding="16dp">

    <TextView
        android:id="@+id/tvSecondHeader"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Activity Details"
        android:textSize="19sp"
        android:textColor="#1C1B1F" />

    <TextView
        android:id="@+id/tvSummary"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Waiting for Intent extras..."
        android:textSize="14sp"
        android:textColor="#49454F" />

    <Button
        android:id="@+id/btnBack"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Back to MainActivity" />

</RelativeLayout>
`;

    const unitTestJava = `package ${pkg};

import org.junit.Test;
import static org.junit.Assert.*;

public class ExampleUnitTest {
    @Test
    public void addition_isCorrect() {
        assertEquals(4L, (long) (2 + 2));
    }
}
`;

    files.push(
      {
        id: "main-activity",
        name: "MainActivity.java",
        tabTitle: "MainActivity.java",
        path: `app/src/main/java/${pkgPath}/MainActivity.java`,
        breadcrumbs: [projectFolderName, "app", "src", "main", "java", pkg, "MainActivity.java"],
        kind: "java",
        content: mainJava,
      },
      {
        id: "second-activity",
        name: "SecondActivity.java",
        tabTitle: "SecondActivity.java",
        path: `app/src/main/java/${pkgPath}/SecondActivity.java`,
        breadcrumbs: [projectFolderName, "app", "src", "main", "java", pkg, "SecondActivity.java"],
        kind: "java",
        content: secondJava,
      },
      {
        id: "activity-main-xml",
        name: "activity_main.xml",
        tabTitle: "activity_main.xml",
        path: "app/src/main/res/layout/activity_main.xml",
        breadcrumbs: [projectFolderName, "app", "src", "main", "res", "layout", "activity_main.xml"],
        kind: "xml",
        isLayoutXml: true,
        content: mainXml,
      },
      {
        id: "activity-second-xml",
        name: "activity_second.xml",
        tabTitle: "activity_second.xml",
        path: "app/src/main/res/layout/activity_second.xml",
        breadcrumbs: [projectFolderName, "app", "src", "main", "res", "layout", "activity_second.xml"],
        kind: "xml",
        isLayoutXml: true,
        content: secondXml,
      },
      {
        id: "manifest-xml",
        name: "AndroidManifest.xml",
        tabTitle: "AndroidManifest.xml",
        path: "app/src/main/AndroidManifest.xml",
        breadcrumbs: [projectFolderName, "app", "manifests", "AndroidManifest.xml"],
        kind: "manifest",
        content: manifestXml,
      },
      {
        id: "strings-xml",
        name: "strings.xml",
        tabTitle: "strings.xml",
        path: "app/src/main/res/values/strings.xml",
        breadcrumbs: [projectFolderName, "app", "res", "values", "strings.xml"],
        kind: "xml",
        content: stringsXml,
      },
      {
        id: "colors-xml",
        name: "colors.xml",
        tabTitle: "colors.xml",
        path: "app/src/main/res/values/colors.xml",
        breadcrumbs: [projectFolderName, "app", "res", "values", "colors.xml"],
        kind: "xml",
        content: colorsXml,
      },
      {
        id: "themes-xml",
        name: "themes.xml",
        tabTitle: "themes.xml",
        path: "app/src/main/res/values/themes.xml",
        breadcrumbs: [projectFolderName, "app", "res", "values", "themes.xml"],
        kind: "xml",
        content: THEMES_XML,
      },
      {
        id: "ic-launcher-fg",
        name: "ic_launcher_foreground.xml",
        tabTitle: "ic_launcher_foreground.xml",
        path: "app/src/main/res/drawable/ic_launcher_foreground.xml",
        breadcrumbs: [projectFolderName, "app", "res", "drawable", "ic_launcher_foreground.xml"],
        kind: "xml",
        content: icForeground,
      },
      {
        id: "ic-launcher-mipmap",
        name: "ic_launcher.xml",
        tabTitle: "ic_launcher.xml",
        path: "app/src/main/res/mipmap/ic_launcher.xml",
        breadcrumbs: [projectFolderName, "app", "res", "mipmap", "ic_launcher.xml"],
        kind: "xml",
        content: icMipmap,
      },
      {
        id: "unit-test-java",
        name: "ExampleUnitTest.java",
        tabTitle: "ExampleUnitTest.java",
        path: `app/src/test/java/${pkgPath}/ExampleUnitTest.java`,
        breadcrumbs: [projectFolderName, "app", "test", "ExampleUnitTest.java"],
        kind: "java",
        isTest: true,
        content: unitTestJava,
      },
      {
        id: "gradle-module",
        name: "build.gradle",
        tabTitle: "build.gradle (Module :app)",
        path: "app/build.gradle",
        breadcrumbs: [projectFolderName, "Gradle Scripts", "build.gradle (Module :app)"],
        kind: "gradle",
        androidHint: "(Module :app)",
        content: buildJavaGroovyModuleGradle(pkg, minSdk),
      },
      {
        id: "gradle-project",
        name: "build.gradle",
        tabTitle: `build.gradle (Project: ${projectFolderName})`,
        path: "build.gradle",
        breadcrumbs: [projectFolderName, "Gradle Scripts", `build.gradle (Project: ${projectFolderName})`],
        kind: "gradle",
        androidHint: `(Project: ${projectFolderName})`,
        content: buildJavaGroovyRootGradle(),
      },
      {
        id: "settings-gradle",
        name: "settings.gradle",
        tabTitle: "settings.gradle",
        path: "settings.gradle",
        breadcrumbs: [projectFolderName, "Gradle Scripts", "settings.gradle"],
        kind: "gradle",
        androidHint: "(Project Settings)",
        content: `rootProject.name = "${projectFolderName}"\ninclude ':app'\n`,
      }
    );
  } else if (opts.template === "calculator-java") {
    const mainJava = `package ${pkg};

import android.os.Bundle;
import android.util.Log;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        Log.i("CalculatorLab", "Calculator initialized");

        EditText etFirst = findViewById(R.id.etFirstNumber);
        EditText etSecond = findViewById(R.id.etSecondNumber);
        TextView tvResult = findViewById(R.id.tvResult);
        Button btnAdd = findViewById(R.id.btnAdd);
        Button btnSub = findViewById(R.id.btnSub);
        Button btnMul = findViewById(R.id.btnMul);
        Button btnDiv = findViewById(R.id.btnDiv);

        btnAdd.setOnClickListener(v -> {
            double a = Double.parseDouble(etFirst.getText().toString().trim());
            double b = Double.parseDouble(etSecond.getText().toString().trim());
            double res = a + b;
            tvResult.setText("Result: " + res);
            Log.i("CalculatorLab", "Add result=" + res);
        });

        btnSub.setOnClickListener(v -> {
            double a = Double.parseDouble(etFirst.getText().toString().trim());
            double b = Double.parseDouble(etSecond.getText().toString().trim());
            double res = a - b;
            tvResult.setText("Result: " + res);
            Log.i("CalculatorLab", "Subtract result=" + res);
        });

        btnMul.setOnClickListener(v -> {
            double a = Double.parseDouble(etFirst.getText().toString().trim());
            double b = Double.parseDouble(etSecond.getText().toString().trim());
            double res = a * b;
            tvResult.setText("Result: " + res);
            Log.i("CalculatorLab", "Multiply result=" + res);
        });

        btnDiv.setOnClickListener(v -> {
            double a = Double.parseDouble(etFirst.getText().toString().trim());
            double b = Double.parseDouble(etSecond.getText().toString().trim());
            if (b == 0) {
                Log.e("CalculatorLab", "Division by zero attempted");
                Toast.makeText(MainActivity.this, "Cannot divide by zero", Toast.LENGTH_SHORT).show();
                tvResult.setText("Error: / by 0");
                return;
            }
            double res = a / b;
            tvResult.setText("Result: " + res);
            Log.i("CalculatorLab", "Divide result=" + res);
        });
    }
}
`;

    const mainXml = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/calcRoot"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="16dp">

    <TextView
        android:id="@+id/tvHeading"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="@string/app_name"
        android:textSize="20sp"
        android:textColor="#1C1B1F" />

    <EditText
        android:id="@+id/etFirstNumber"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:hint="First number"
        android:inputType="numberDecimal" />

    <EditText
        android:id="@+id/etSecondNumber"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:hint="Second number"
        android:inputType="numberDecimal" />

    <TextView
        android:id="@+id/tvResult"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Result: 0"
        android:textSize="17sp"
        android:textColor="#3574F0" />

    <Button
        android:id="@+id/btnAdd"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Add (+)" />

    <Button
        android:id="@+id/btnSub"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Subtract (-)" />

    <Button
        android:id="@+id/btnMul"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Multiply (×)" />

    <Button
        android:id="@+id/btnDiv"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Divide (÷)" />

</LinearLayout>
`;

    files.push(
      {
        id: "main-activity",
        name: "MainActivity.java",
        tabTitle: "MainActivity.java",
        path: `app/src/main/java/${pkgPath}/MainActivity.java`,
        breadcrumbs: [projectFolderName, "app", "src", "main", "java", pkg, "MainActivity.java"],
        kind: "java",
        content: mainJava,
      },
      {
        id: "activity-main-xml",
        name: "activity_main.xml",
        tabTitle: "activity_main.xml",
        path: "app/src/main/res/layout/activity_main.xml",
        breadcrumbs: [projectFolderName, "app", "src", "main", "res", "layout", "activity_main.xml"],
        kind: "xml",
        isLayoutXml: true,
        content: mainXml,
      },
      {
        id: "manifest-xml",
        name: "AndroidManifest.xml",
        tabTitle: "AndroidManifest.xml",
        path: "app/src/main/AndroidManifest.xml",
        breadcrumbs: [projectFolderName, "app", "manifests", "AndroidManifest.xml"],
        kind: "manifest",
        content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${pkg}">
    <application
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name">
        <activity android:name=".MainActivity" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`,
      },
      {
        id: "strings-xml",
        name: "strings.xml",
        tabTitle: "strings.xml",
        path: "app/src/main/res/values/strings.xml",
        breadcrumbs: [projectFolderName, "app", "res", "values", "strings.xml"],
        kind: "xml",
        content: stringsXml,
      },
      {
        id: "colors-xml",
        name: "colors.xml",
        tabTitle: "colors.xml",
        path: "app/src/main/res/values/colors.xml",
        breadcrumbs: [projectFolderName, "app", "res", "values", "colors.xml"],
        kind: "xml",
        content: colorsXml,
      },
      {
        id: "ic-launcher-fg",
        name: "ic_launcher_foreground.xml",
        tabTitle: "ic_launcher_foreground.xml",
        path: "app/src/main/res/drawable/ic_launcher_foreground.xml",
        breadcrumbs: [projectFolderName, "app", "res", "drawable", "ic_launcher_foreground.xml"],
        kind: "xml",
        content: icForeground,
      },
      {
        id: "ic-launcher-mipmap",
        name: "ic_launcher.xml",
        tabTitle: "ic_launcher.xml",
        path: "app/src/main/res/mipmap/ic_launcher.xml",
        breadcrumbs: [projectFolderName, "app", "res", "mipmap", "ic_launcher.xml"],
        kind: "xml",
        content: icMipmap,
      },
      {
        id: "gradle-module",
        name: "build.gradle",
        tabTitle: "build.gradle (Module :app)",
        path: "app/build.gradle",
        breadcrumbs: [projectFolderName, "Gradle Scripts", "build.gradle (Module :app)"],
        kind: "gradle",
        androidHint: "(Module :app)",
        content: buildJavaGroovyModuleGradle(pkg, minSdk),
      },
      {
        id: "settings-gradle",
        name: "settings.gradle",
        tabTitle: "settings.gradle",
        path: "settings.gradle",
        breadcrumbs: [projectFolderName, "Gradle Scripts", "settings.gradle"],
        kind: "gradle",
        androidHint: "(Project Settings)",
        content: `rootProject.name = "${projectFolderName}"\ninclude ':app'\n`,
      }
    );
  } else if (opts.template === "empty-views-java") {
    files.push(
      {
        id: "main-activity",
        name: "MainActivity.java",
        tabTitle: "MainActivity.java",
        path: `app/src/main/java/${pkgPath}/MainActivity.java`,
        breadcrumbs: [projectFolderName, "app", "src", "main", "java", pkg, "MainActivity.java"],
        kind: "java",
        content: `package ${pkg};

import android.os.Bundle;
import android.util.Log;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private int taps = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        TextView tvHello = findViewById(R.id.tvHello);
        Button btnAction = findViewById(R.id.btnAction);

        btnAction.setOnClickListener(v -> {
            taps++;
            tvHello.setText("Button clicked " + taps + " times");
            Log.i("MainActivity", "Tap count=" + taps);
            Toast.makeText(MainActivity.this, "Tapped " + taps, Toast.LENGTH_SHORT).show();
        });
    }
}
`,
      },
      {
        id: "activity-main-xml",
        name: "activity_main.xml",
        tabTitle: "activity_main.xml",
        path: "app/src/main/res/layout/activity_main.xml",
        breadcrumbs: [projectFolderName, "app", "src", "main", "res", "layout", "activity_main.xml"],
        kind: "xml",
        isLayoutXml: true,
        content: `<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:id="@+id/main"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:padding="16dp">

    <TextView
        android:id="@+id/tvHello"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Hello World!"
        android:textSize="20sp"
        app:layout_constraintBottom_toBottomOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintTop_toTopOf="parent" />

    <Button
        android:id="@+id/btnAction"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Tap Me"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintTop_toBottomOf="@id/tvHello" />

</androidx.constraintlayout.widget.ConstraintLayout>
`,
      },
      {
        id: "manifest-xml",
        name: "AndroidManifest.xml",
        tabTitle: "AndroidManifest.xml",
        path: "app/src/main/AndroidManifest.xml",
        breadcrumbs: [projectFolderName, "app", "manifests", "AndroidManifest.xml"],
        kind: "manifest",
        content: ANDROID_MANIFEST_XML.replace(/com\.example\.myapplication/g, pkg),
      },
      {
        id: "strings-xml",
        name: "strings.xml",
        tabTitle: "strings.xml",
        path: "app/src/main/res/values/strings.xml",
        breadcrumbs: [projectFolderName, "app", "res", "values", "strings.xml"],
        kind: "xml",
        content: stringsXml,
      },
      {
        id: "colors-xml",
        name: "colors.xml",
        tabTitle: "colors.xml",
        path: "app/src/main/res/values/colors.xml",
        breadcrumbs: [projectFolderName, "app", "res", "values", "colors.xml"],
        kind: "xml",
        content: colorsXml,
      },
      {
        id: "ic-launcher-fg",
        name: "ic_launcher_foreground.xml",
        tabTitle: "ic_launcher_foreground.xml",
        path: "app/src/main/res/drawable/ic_launcher_foreground.xml",
        breadcrumbs: [projectFolderName, "app", "res", "drawable", "ic_launcher_foreground.xml"],
        kind: "xml",
        content: icForeground,
      },
      {
        id: "gradle-module",
        name: "build.gradle",
        tabTitle: "build.gradle (Module :app)",
        path: "app/build.gradle",
        breadcrumbs: [projectFolderName, "Gradle Scripts", "build.gradle (Module :app)"],
        kind: "gradle",
        androidHint: "(Module :app)",
        content: buildJavaGroovyModuleGradle(pkg, minSdk),
      },
      {
        id: "settings-gradle",
        name: "settings.gradle",
        tabTitle: "settings.gradle",
        path: "settings.gradle",
        breadcrumbs: [projectFolderName, "Gradle Scripts", "settings.gradle"],
        kind: "gradle",
        androidHint: "(Project Settings)",
        content: `rootProject.name = "${projectFolderName}"\ninclude ':app'\n`,
      }
    );
  } else if (opts.template === "empty-views-kotlin") {
    files.push(
      {
        id: "main-activity",
        name: "MainActivity",
        tabTitle: "MainActivity.kt",
        path: `app/src/main/java/${pkgPath}/MainActivity.kt`,
        breadcrumbs: [projectFolderName, "app", "src", "main", "java", pkg, "MainActivity.kt"],
        kind: "kotlin",
        content: `package ${pkg}

import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        val input = findViewById<EditText>(R.id.etInput)
        val output = findViewById<TextView>(R.id.tvOutput)
        val btn = findViewById<Button>(R.id.btnRun)

        btn.setOnClickListener {
            val text = input.getText().toString().trim()
            if (text.isEmpty()) {
                Toast.makeText(this, "Enter text first", Toast.LENGTH_SHORT).show()
                return
            }
            output.setText("Kotlin says: $text")
            Log.i("MainActivity", "Updated output to: $text")
        }
    }
}
`,
      },
      {
        id: "activity-main-xml",
        name: "activity_main.xml",
        tabTitle: "activity_main.xml",
        path: "app/src/main/res/layout/activity_main.xml",
        breadcrumbs: [projectFolderName, "app", "src", "main", "res", "layout", "activity_main.xml"],
        kind: "xml",
        isLayoutXml: true,
        content: `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/main"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="16dp">

    <TextView
        android:id="@+id/tvOutput"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="@string/app_name"
        android:textSize="20sp" />

    <EditText
        android:id="@+id/etInput"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:hint="Type a message" />

    <Button
        android:id="@+id/btnRun"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Update Text" />

</LinearLayout>
`,
      },
      {
        id: "manifest-xml",
        name: "AndroidManifest.xml",
        tabTitle: "AndroidManifest.xml",
        path: "app/src/main/AndroidManifest.xml",
        breadcrumbs: [projectFolderName, "app", "manifests", "AndroidManifest.xml"],
        kind: "manifest",
        content: ANDROID_MANIFEST_XML.replace(/com\.example\.myapplication/g, pkg),
      },
      {
        id: "strings-xml",
        name: "strings.xml",
        tabTitle: "strings.xml",
        path: "app/src/main/res/values/strings.xml",
        breadcrumbs: [projectFolderName, "app", "res", "values", "strings.xml"],
        kind: "xml",
        content: stringsXml,
      },
      {
        id: "gradle-module",
        name: "build.gradle.kts",
        tabTitle: "build.gradle.kts (Module :app)",
        path: "app/build.gradle.kts",
        breadcrumbs: [projectFolderName, "Gradle Scripts", "build.gradle.kts (Module :app)"],
        kind: "gradle-kts",
        androidHint: "(Module :app)",
        content: BUILD_GRADLE_MODULE_KTS.replace(/com\.example\.myapplication/g, pkg),
      },
      {
        id: "settings-gradle",
        name: "settings.gradle.kts",
        tabTitle: "settings.gradle.kts",
        path: "settings.gradle.kts",
        breadcrumbs: [projectFolderName, "Gradle Scripts", "settings.gradle.kts"],
        kind: "gradle-kts",
        androidHint: "(Project Settings)",
        content: `rootProject.name = "${projectFolderName}"\ninclude(":app")\n`,
      }
    );
  } else {
    // compose-kotlin
    files.push(
      {
        id: "main-activity",
        name: "MainActivity",
        tabTitle: "MainActivity.kt",
        path: `app/src/main/java/${pkgPath}/MainActivity.kt`,
        breadcrumbs: [projectFolderName, "app", "src", "main", "java", pkg, "MainActivity.kt"],
        kind: "kotlin",
        hasComposePreview: true,
        content: MAIN_ACTIVITY_KT.replace(/com\.example\.myapplication/g, pkg).replace(/MyApplicationTheme/g, projectFolderName + "Theme"),
      },
      {
        id: "manifest-xml",
        name: "AndroidManifest.xml",
        tabTitle: "AndroidManifest.xml",
        path: "app/src/main/AndroidManifest.xml",
        breadcrumbs: [projectFolderName, "app", "manifests", "AndroidManifest.xml"],
        kind: "manifest",
        content: ANDROID_MANIFEST_XML.replace(/com\.example\.myapplication/g, pkg),
      },
      {
        id: "strings-xml",
        name: "strings.xml",
        tabTitle: "strings.xml",
        path: "app/src/main/res/values/strings.xml",
        breadcrumbs: [projectFolderName, "app", "res", "values", "strings.xml"],
        kind: "xml",
        content: stringsXml,
      },
      {
        id: "gradle-module",
        name: "build.gradle.kts",
        tabTitle: "build.gradle.kts (Module :app)",
        path: "app/build.gradle.kts",
        breadcrumbs: [projectFolderName, "Gradle Scripts", "build.gradle.kts (Module :app)"],
        kind: "gradle-kts",
        androidHint: "(Module :app)",
        content: BUILD_GRADLE_MODULE_KTS.replace(/com\.example\.myapplication/g, pkg),
      },
      {
        id: "settings-gradle",
        name: "settings.gradle.kts",
        tabTitle: "settings.gradle.kts",
        path: "settings.gradle.kts",
        breadcrumbs: [projectFolderName, "Gradle Scripts", "settings.gradle.kts"],
        kind: "gradle-kts",
        androidHint: "(Project Settings)",
        content: `rootProject.name = "${projectFolderName}"\ninclude(":app")\n`,
      }
    );
  }

  return {
    id: idSlug,
    name: projectFolderName,
    monogram: makeMonogram(cleanName),
    monogramBg: opts.template.indexOf("java") >= 0 ? "#2E6F40" : "#3574F0",
    packageName: pkg,
    branch: "main",
    language: opts.template.indexOf("java") >= 0 ? "java" : "kotlin",
    template: opts.template,
    folders: [
      "app/src/main/res/drawable",
      "app/src/main/res/layout",
      "app/src/main/res/mipmap",
      "app/src/main/res/values",
    ],
    snapshotFiles: files.map((f) => ({ ...f })),
    files,
  };
}

const STUDENT_PORTAL_PRESET = {
  ...createNewAndroidProject({
    appName: "StudentPortal",
    packageName: "com.example.studentportal",
    template: "two-activity-java",
    minSdk: 24,
  }),
  id: "student-portal-java",
  monogramBg: "#2E6F40",
};

const CALCULATOR_PRESET = {
  ...createNewAndroidProject({
    appName: "CalculatorLab",
    packageName: "com.example.calculator",
    template: "calculator-java",
    minSdk: 24,
  }),
  id: "calculator-java",
  monogramBg: "#9A5B25",
};

STUDIO_PRESETS.push(STUDENT_PORTAL_PRESET, CALCULATOR_PRESET);

export const DEFAULT_UI_PRESET_ID = "student-portal-java";

export function createProjectFile(
  preset: StudioProjectPreset,
  opts: {
    parentDir: string;
    fileName: string;
    registerInManifest?: boolean;
  }
): { preset: StudioProjectPreset; createdFile: StudioFile } {
  const cleanDir = opts.parentDir.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  let rawName = opts.fileName.trim().replace(/[\\/]/g, "");
  if (!rawName) rawName = "NewClass.java";
  if (rawName.indexOf(".") < 0) {
    rawName += preset.language === "java" || cleanDir.indexOf("/java/") >= 0 ? ".java" : ".xml";
  }

  const fullPath = cleanDir ? `${cleanDir}/${rawName}` : rawName;
  const stem = rawName.replace(/\.[^.]+$/, "");
  const ext = rawName.slice(rawName.lastIndexOf(".")).toLowerCase();

  let kind: StudioFileKind = "text";
  let isLayoutXml = false;
  let content = "";

  if (ext === ".java") {
    kind = "java";
    const isActivity = /Activity$/.test(stem);
    const layoutSnake = stem
      .replace(/Activity$/, "")
      .replace(/([a-z])([A-Z])/g, "$1_$2")
      .toLowerCase();
    content = isActivity
      ? `package ${preset.packageName};

import android.os.Bundle;
import android.util.Log;
import androidx.appcompat.app.AppCompatActivity;

public class ${stem} extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_${layoutSnake || "main"});
        Log.i("${stem}", "onCreate executed");
    }
}
`
      : `package ${preset.packageName};

public class ${stem} {
    public String describe() {
        return "${stem} ready";
    }
}
`;
  } else if (ext === ".kt") {
    kind = "kotlin";
    content = `package ${preset.packageName}

class ${stem} {
    fun describe(): String = "${stem} ready"
}
`;
  } else if (ext === ".xml") {
    kind = rawName === "AndroidManifest.xml" ? "manifest" : "xml";
    isLayoutXml = fullPath.indexOf("res/layout/") >= 0 || cleanDir.indexOf("layout") >= 0;
    if (isLayoutXml) {
      content = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="16dp">

    <TextView
        android:id="@+id/tvHeader"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="${stem}"
        android:textSize="18sp" />

</LinearLayout>
`;
    } else if (fullPath.indexOf("res/values/") >= 0) {
      content = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="${stem.replace(/[^A-Za-z0-9_]/g, "_")}">Sample Value</string>
</resources>
`;
    } else {
      content = `<?xml version="1.0" encoding="utf-8"?>
<resources />
`;
    }
  } else if (ext === ".gradle") {
    kind = "gradle";
    content = "// Gradle build script\n";
  } else if (ext === ".kts") {
    kind = "gradle-kts";
    content = "// Kotlin Gradle build script\n";
  } else if (ext === ".properties") {
    kind = "properties";
  }

  const createdFile: StudioFile = {
    id: `file-${stem.toLowerCase()}-${Date.now().toString(36)}`,
    name: rawName,
    tabTitle: rawName,
    path: fullPath,
    breadcrumbs: [preset.name, ...fullPath.split("/")],
    kind,
    isLayoutXml,
    isTest: fullPath.indexOf("/test/") >= 0 || fullPath.indexOf("/androidTest/") >= 0,
    content,
  };

  let nextFiles = [...preset.files, createdFile];

  if (opts.registerInManifest && kind === "java" || (opts.registerInManifest && kind === "kotlin")) {
    if (/Activity$/.test(stem)) {
      nextFiles = nextFiles.map((f) => {
        if (f.kind === "manifest" && f.content.indexOf(`.${stem}`) < 0) {
          const insertion = `        <activity android:name=".${stem}" android:exported="false" />\n`;
          return {
            ...f,
            content: f.content.replace("</application>", `${insertion}    </application>`),
          };
        }
        return f;
      });
    }
  }

  return {
    preset: { ...preset, files: nextFiles },
    createdFile,
  };
}

export function createProjectFolder(preset: StudioProjectPreset, folderPath: string): StudioProjectPreset {
  const cleaned = folderPath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!cleaned) return preset;
  const existing = preset.folders ? [...preset.folders] : [];
  if (existing.indexOf(cleaned) < 0) existing.push(cleaned);
  return { ...preset, folders: existing };
}

export function renameProjectFile(
  preset: StudioProjectPreset,
  fileId: string,
  newName: string
): StudioProjectPreset {
  const cleanName = newName.trim().replace(/[\\/]/g, "");
  if (!cleanName) return preset;
  return {
    ...preset,
    files: preset.files.map((f) => {
      if (f.id !== fileId) return f;
      const slash = f.path.lastIndexOf("/");
      const dir = slash >= 0 ? f.path.slice(0, slash + 1) : "";
      const nextPath = dir + cleanName;
      return {
        ...f,
        name: cleanName,
        tabTitle: cleanName,
        path: nextPath,
        breadcrumbs: [preset.name, ...nextPath.split("/")],
        isLayoutXml: nextPath.indexOf("res/layout/") >= 0,
      };
    }),
  };
}

export function deleteProjectFile(preset: StudioProjectPreset, fileId: string): StudioProjectPreset {
  if (preset.files.length <= 1) return preset;
  return {
    ...preset,
    files: preset.files.filter((f) => f.id !== fileId),
  };
}

export interface GitFileStatusEntry {
  path: string;
  fileId?: string;
  status: "modified" | "added" | "deleted";
}

export function computeProjectGitStatus(
  currentFiles: StudioFile[],
  snapshotFiles?: StudioFile[]
): GitFileStatusEntry[] {
  if (!snapshotFiles || snapshotFiles.length === 0) return [];
  const baseByPath: Record<string, StudioFile> = {};
  for (let i = 0; i < snapshotFiles.length; i++) {
    baseByPath[snapshotFiles[i].path] = snapshotFiles[i];
  }
  const curByPath: Record<string, StudioFile> = {};
  const entries: GitFileStatusEntry[] = [];

  for (let i = 0; i < currentFiles.length; i++) {
    const cur = currentFiles[i];
    curByPath[cur.path] = cur;
    const base = baseByPath[cur.path];
    if (!base) {
      entries.push({ path: cur.path, fileId: cur.id, status: "added" });
    } else if (base.content !== cur.content) {
      entries.push({ path: cur.path, fileId: cur.id, status: "modified" });
    }
  }
  for (let i = 0; i < snapshotFiles.length; i++) {
    const base = snapshotFiles[i];
    if (!curByPath[base.path]) {
      entries.push({ path: base.path, status: "deleted" });
    }
  }
  return entries;
}

export function buildAndroidProjectTree(preset: StudioProjectPreset, viewMode: AndroidViewMode): AndroidTreeNode[] {
  const pkgPath = preset.packageName.replace(/\./g, "/");

  if (viewMode === "Packages") {
    const pkgFiles = preset.files.filter((f) => f.kind === "kotlin" || f.kind === "java");
    return [
      {
        id: "pkg-root",
        label: preset.packageName,
        kind: "package",
        folderPath: `app/src/main/java/${pkgPath}`,
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
    // Build nested folder hierarchy from all real paths + explicit folders
    interface FolderBucket {
      name: string;
      fullPath: string;
      subfolders: Record<string, FolderBucket>;
      files: StudioFile[];
    }
    const root: FolderBucket = { name: preset.name, fullPath: "", subfolders: {}, files: [] };

    const ensureFolder = (parts: string[]): FolderBucket => {
      let cur = root;
      let acc = "";
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        acc = acc ? `${acc}/${part}` : part;
        if (!cur.subfolders[part]) {
          cur.subfolders[part] = { name: part, fullPath: acc, subfolders: {}, files: [] };
        }
        cur = cur.subfolders[part];
      }
      return cur;
    };

    const extraFolders = preset.folders || [];
    for (let i = 0; i < extraFolders.length; i++) {
      const segs = extraFolders[i].split("/").filter(Boolean);
      if (segs.length > 0) ensureFolder(segs);
    }

    for (let i = 0; i < preset.files.length; i++) {
      const f = preset.files[i];
      const segs = f.path.split("/").filter(Boolean);
      const dirSegs = segs.slice(0, -1);
      const bucket = ensureFolder(dirSegs);
      bucket.files.push(f);
    }

    const toTreeNodes = (bucket: FolderBucket): AndroidTreeNode[] => {
      const folderKeys = Object.keys(bucket.subfolders).sort();
      const nodes: AndroidTreeNode[] = [];
      for (let i = 0; i < folderKeys.length; i++) {
        const sub = bucket.subfolders[folderKeys[i]];
        nodes.push({
          id: `proj-dir-${sub.fullPath}`,
          label: sub.name,
          kind: sub.fullPath === "app" ? "module" : "folder",
          folderPath: sub.fullPath,
          children: toTreeNodes(sub),
        });
      }
      for (let i = 0; i < bucket.files.length; i++) {
        const f = bucket.files[i];
        nodes.push({
          id: `proj-f-${f.id}`,
          label: f.tabTitle,
          kind: "file",
          fileId: f.id,
          fileKind: f.kind,
          isTest: f.isTest,
        });
      }
      return nodes;
    };

    return [
      {
        id: "proj-root",
        label: preset.name,
        hint: "~/AndroidStudioProjects/" + preset.name,
        kind: "folder",
        folderPath: "",
        children: toTreeNodes(root),
      },
    ];
  }

  // Android View hierarchy (manifests, kotlin+java, res, Gradle Scripts)
  const manifestFiles = preset.files.filter((f) => f.kind === "manifest");
  const codeFiles = preset.files.filter((f) => f.kind === "kotlin" || f.kind === "java");
  const mainCodeFiles = codeFiles.filter((f) => !f.isTest && f.path.indexOf("/ui/theme/") < 0);
  const themeCodeFiles = codeFiles.filter((f) => !f.isTest && f.path.indexOf("/ui/theme/") >= 0);
  const androidTestFiles = codeFiles.filter((f) => f.path.indexOf("/androidTest/") >= 0);
  const unitTestFiles = codeFiles.filter((f) => f.path.indexOf("/test/") >= 0);

  const mainPkgChildren: AndroidTreeNode[] = mainCodeFiles.map((f) => ({
    id: f.id === "main-activity" ? "node-main-activity" : "node-" + f.id,
    label: f.name,
    kind: "file" as const,
    fileId: f.id,
    fileKind: f.kind,
  }));

  if (themeCodeFiles.length > 0) {
    mainPkgChildren.push({
      id: "node-ui-theme",
      label: "ui.theme",
      kind: "package",
      folderPath: `app/src/main/java/${pkgPath}/ui/theme`,
      children: themeCodeFiles.map((f) => ({
        id: "node-" + f.id,
        label: f.name,
        kind: "file" as const,
        fileId: f.id,
        fileKind: f.kind,
      })),
    });
  }

  const kotlinPackages: AndroidTreeNode[] = [
    {
      id: "node-pkg-main",
      label: preset.packageName,
      kind: "package",
      folderPath: `app/src/main/java/${pkgPath}`,
      children: mainPkgChildren,
    },
  ];

  if (androidTestFiles.length > 0) {
    kotlinPackages.push({
      id: "node-pkg-android-test",
      label: preset.packageName + " (androidTest)",
      kind: "package",
      folderPath: `app/src/androidTest/java/${pkgPath}`,
      isTest: true,
      children: androidTestFiles.map((f) => ({
        id: "node-" + f.id,
        label: f.name,
        kind: "file" as const,
        fileId: f.id,
        fileKind: f.kind,
        isTest: true,
      })),
    });
  }

  if (unitTestFiles.length > 0) {
    kotlinPackages.push({
      id: "node-pkg-unit-test",
      label: preset.packageName + " (test)",
      kind: "package",
      folderPath: `app/src/test/java/${pkgPath}`,
      isTest: true,
      children: unitTestFiles.map((f) => ({
        id: "node-" + f.id,
        label: f.name,
        kind: "file" as const,
        fileId: f.id,
        fileKind: f.kind,
        isTest: true,
      })),
    });
  }

  const drawableFiles = preset.files.filter((f) => f.path.indexOf("res/drawable/") >= 0);
  const layoutFiles = preset.files.filter((f) => f.path.indexOf("res/layout/") >= 0 || f.isLayoutXml);
  const mipmapFiles = preset.files.filter((f) => f.path.indexOf("res/mipmap/") >= 0);
  const valuesFiles = preset.files.filter((f) => f.path.indexOf("res/values/") >= 0);
  const otherAppFiles = preset.files.filter(
    (f) =>
      f.path.indexOf("app/") === 0 &&
      f.kind !== "manifest" &&
      f.kind !== "kotlin" &&
      f.kind !== "java" &&
      f.kind !== "gradle" &&
      f.kind !== "gradle-kts" &&
      f.kind !== "proguard" &&
      f.path.indexOf("res/drawable/") < 0 &&
      f.path.indexOf("res/layout/") < 0 &&
      f.path.indexOf("res/mipmap/") < 0 &&
      f.path.indexOf("res/values/") < 0 &&
      !f.isLayoutXml
  );

  const resChildren: AndroidTreeNode[] = [
    {
      id: "node-res-drawable",
      label: "drawable",
      kind: "folder",
      folderPath: "app/src/main/res/drawable",
      children: drawableFiles.map((f) => ({
        id: "node-" + f.id,
        label: f.name,
        kind: "file" as const,
        fileId: f.id,
        fileKind: f.kind,
      })),
    },
    {
      id: "node-res-layout",
      label: "layout",
      kind: "folder",
      folderPath: "app/src/main/res/layout",
      children: layoutFiles.map((f) => ({
        id: "node-" + f.id,
        label: f.name,
        kind: "file" as const,
        fileId: f.id,
        fileKind: f.kind,
      })),
    },
    {
      id: "node-res-mipmap",
      label: "mipmap",
      kind: "folder",
      folderPath: "app/src/main/res/mipmap",
      children: mipmapFiles.map((f) => ({
        id: "node-" + f.id,
        label: f.name,
        kind: "file" as const,
        fileId: f.id,
        fileKind: f.kind,
      })),
    },
    {
      id: "node-res-values",
      label: "values",
      kind: "folder",
      folderPath: "app/src/main/res/values",
      children: valuesFiles.map((f) => ({
        id: "node-" + f.id,
        label: f.name,
        kind: "file" as const,
        fileId: f.id,
        fileKind: f.kind,
      })),
    },
  ];

  // Add any custom user folders under app/src/main/res/
  const extraFolders = preset.folders || [];
  for (let i = 0; i < extraFolders.length; i++) {
    const fp = extraFolders[i];
    if (
      fp.indexOf("app/src/main/res/") === 0 &&
      ["app/src/main/res/drawable", "app/src/main/res/layout", "app/src/main/res/mipmap", "app/src/main/res/values"].indexOf(fp) < 0
    ) {
      const folderLabel = fp.slice("app/src/main/res/".length);
      const insideFiles = preset.files.filter((f) => f.path.indexOf(fp + "/") === 0);
      resChildren.push({
        id: "node-res-custom-" + folderLabel,
        label: folderLabel,
        kind: "folder",
        folderPath: fp,
        children: insideFiles.map((f) => ({
          id: "node-" + f.id,
          label: f.name,
          kind: "file" as const,
          fileId: f.id,
          fileKind: f.kind,
        })),
      });
    }
  }

  const gradleFiles = preset.files.filter(
    (f) => f.kind === "gradle" || f.kind === "gradle-kts" || f.kind === "toml" || f.kind === "properties" || f.kind === "proguard"
  );
  const gradleChildren: AndroidTreeNode[] = gradleFiles.map((gf) => ({
    id: "node-" + gf.id,
    label: gf.name,
    hint: gf.androidHint,
    kind: "file" as const,
    fileId: gf.id,
    fileKind: gf.kind,
  }));

  const appChildren: AndroidTreeNode[] = [];
  if (manifestFiles.length > 0) {
    appChildren.push({
      id: "node-manifests",
      label: "manifests",
      kind: "source-root",
      folderPath: "app/src/main",
      children: manifestFiles.map((mf) => ({
        id: "node-" + mf.id,
        label: mf.name,
        kind: "file" as const,
        fileId: mf.id,
        fileKind: "manifest" as const,
      })),
    });
  }
  appChildren.push({
    id: "node-kotlin-java",
    label: "kotlin+java",
    kind: "source-root",
    folderPath: `app/src/main/java/${pkgPath}`,
    children: kotlinPackages,
  });
  appChildren.push({
    id: "node-res",
    label: "res",
    kind: "resources-root",
    folderPath: "app/src/main/res",
    children: resChildren,
  });

  if (otherAppFiles.length > 0) {
    appChildren.push({
      id: "node-other-assets",
      label: "assets",
      kind: "folder",
      folderPath: "app/src/main/assets",
      children: otherAppFiles.map((f) => ({
        id: "node-" + f.id,
        label: f.name,
        kind: "file" as const,
        fileId: f.id,
        fileKind: f.kind,
      })),
    });
  }

  return [
    {
      id: "node-app",
      label: "app",
      kind: "module",
      folderPath: "app",
      children: appChildren,
    },
    {
      id: "node-gradle-scripts",
      label: "Gradle Scripts",
      kind: "gradle-root",
      folderPath: "",
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

/** Logcat-style local time: 2026-11-17 14:03:22.517 */
export function logcatTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

export function createInitialLogcatEntries(packageName: string, baseMs?: number): LogcatEntry[] {
  // Without baseMs (server render) the fixed sample times are kept so hydration matches; the client passes Date.now().
  const at = (fixed: string, offsetMs: number) => (baseMs === undefined ? fixed : logcatTime(baseMs - 1200 + offsetMs));
  return [
    {
      id: "log-1",
      timestamp: at("2026-11-15 22:42:10.114", 0),
      pid: 4820,
      tid: 4820,
      tag: "ActivityTaskManager",
      packageName: "system_process",
      level: "I",
      message: `START u0 {act=android.intent.action.MAIN cat=[android.intent.category.LAUNCHER] cmp=${packageName}/.MainActivity} with LAUNCH_MULTIPLE from uid 10189`,
    },
    {
      id: "log-2",
      timestamp: at("2026-11-15 22:42:10.302", 188),
      pid: 6142,
      tid: 6142,
      tag: "CompatibilityChange",
      packageName,
      level: "D",
      message: "Compat change id reported: 171979766; UID 10194; state: ENABLED",
    },
    {
      id: "log-3",
      timestamp: at("2026-11-15 22:42:10.489", 375),
      pid: 6142,
      tid: 6142,
      tag: "MainActivity",
      packageName,
      level: "I",
      message: "onCreate: initialized Compose content",
    },
    {
      id: "log-4",
      timestamp: at("2026-11-15 22:42:10.618", 504),
      pid: 6142,
      tid: 6171,
      tag: "HWUI",
      packageName,
      level: "D",
      message: "RenderThread Vulkan pipeline warmed up (Medium Phone API 35)",
    },
    {
      id: "log-5",
      timestamp: at("2026-11-15 22:42:10.745", 631),
      pid: 6142,
      tid: 6142,
      tag: "Choreographer",
      packageName,
      level: "I",
      message: "Displayed com.example.myapplication/.MainActivity for user 0: +631ms",
    },
    {
      id: "log-6",
      timestamp: at("2026-11-15 22:42:11.012", 898),
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
  const resources = parseAndroidResources(files);

  files.forEach((file) => {
    const lines = file.content.split(/\r?\n/);
    if (file.kind === "kotlin" || file.kind === "java" || file.kind === "gradle" || file.kind === "gradle-kts") {
      let braceBalance = 0;
      let firstOpenLine = 1;
      let inBlockComment = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Braces inside /* ... */ (possibly spanning lines) are not code.
        let code = "";
        let rest = line;
        while (rest.length > 0) {
          if (inBlockComment) {
            const end = rest.indexOf("*/");
            if (end < 0) { rest = ""; } else { inBlockComment = false; rest = rest.slice(end + 2); }
          } else {
            const start = rest.indexOf("/*");
            if (start < 0) { code += rest; rest = ""; } else { code += rest.slice(0, start); inBlockComment = true; rest = rest.slice(start + 2); }
          }
        }
        const stripped = code.replace(/\/\/.*$/, "");
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
      const parsed = parseAndroidLayoutXml(file.content);
      parsed.errors.forEach((err, idx) => {
        problems.push({
          id: `${file.id}-xml-${err.line}-${idx}`,
          fileId: file.id,
          fileName: file.tabTitle,
          line: err.line,
          column: 1,
          severity: "error",
          message: err.message,
        });
      });

      // Check unresolved @string/... references
      for (let i = 0; i < lines.length; i++) {
        const strRef = /@string\/([A-Za-z_][A-Za-z0-9_]*)/g;
        let sm = strRef.exec(lines[i]);
        while (sm) {
          if (resources.strings[sm[1]] === undefined) {
            problems.push({
              id: `${file.id}-str-${i + 1}-${sm[1]}`,
              fileId: file.id,
              fileName: file.tabTitle,
              line: i + 1,
              column: sm.index + 1,
              severity: "warning",
              message: `Unresolved string resource @string/${sm[1]}`,
            });
          }
          sm = strRef.exec(lines[i]);
        }
      }
    }
  });

  unresolvedReferenceProblems(files).forEach((p) => problems.push(p));
  return problems;
}

// Names Kotlin resolves without an import (kotlin.*, kotlin.collections.*, java.lang.*) that are commonly called
// with a capital letter, e.g. Exception("x") or StringBuilder().
const KOTLIN_IMPLICIT_CALLS = new Set([
  "Pair", "Triple", "Any", "Unit", "String", "Int", "Long", "Double", "Float", "Boolean", "Char", "Byte", "Short",
  "Array", "IntArray", "LongArray", "DoubleArray", "FloatArray", "BooleanArray", "CharArray", "ByteArray",
  "ArrayList", "HashMap", "HashSet", "LinkedHashMap", "LinkedHashSet", "StringBuilder", "Regex", "Lazy",
  "Exception", "RuntimeException", "Error", "Throwable", "IllegalArgumentException", "IllegalStateException",
  "IndexOutOfBoundsException", "NullPointerException", "NumberFormatException", "UnsupportedOperationException",
  "ArithmeticException", "ClassCastException", "NoSuchElementException", "ConcurrentModificationException",
  "Thread", "Runnable", "Math", "System", "Integer", "Object", "Comparable", "Comparator", "Iterable", "Sequence",
  "Suppress", "JvmStatic", "JvmField", "JvmOverloads", "Deprecated", "Volatile", "Synchronized", "Throws",
]);

/** Kotlin source without comments and string contents (template expressions are kept). */
function kotlinCode(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const two = src.substr(i, 2);
    if (two === "//") {
      while (i < n && src.charAt(i) !== "\n") i++;
    } else if (two === "/*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end < 0 ? n : end + 2;
      out += src.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop;
    } else if (src.charAt(i) === '"') {
      const raw = src.substr(i, 3) === '"""';
      const quote = raw ? '"""' : '"';
      out += quote;
      i += quote.length;
      while (i < n && src.substr(i, quote.length) !== quote) {
        if (!raw && src.charAt(i) === "\\") { out += "  "; i += 2; continue; }
        if (src.substr(i, 2) === "${") {
          let depth = 0;
          while (i < n) {
            const c = src.charAt(i);
            out += c;
            i++;
            if (c === "{") depth++;
            else if (c === "}" && --depth === 0) break;
          }
          continue;
        }
        out += src.charAt(i) === "\n" ? "\n" : " ";
        i++;
      }
      out += quote;
      i += quote.length;
    } else if (src.charAt(i) === "'") {
      const end = src.indexOf("'", i + (src.charAt(i + 1) === "\\" ? 3 : 2));
      const stop = end < 0 ? i + 1 : end + 1;
      out += " ".repeat(stop - i);
      i = stop;
    } else {
      out += src.charAt(i);
      i++;
    }
  }
  return out;
}

/**
 * A capitalised call (a Composable or constructor) must be declared in the project, imported, or implicit in Kotlin;
 * otherwise kotlinc reports "Unresolved reference". Files with wildcard imports are skipped, since the names they
 * bring in are unknown here.
 */
function unresolvedReferenceProblems(files: StudioFile[]): StudioProblem[] {
  const problems: StudioProblem[] = [];
  const kotlinFiles = files.filter((f) => f.kind === "kotlin");
  const declared = new Set<string>();
  kotlinFiles.forEach((f) => {
    const code = kotlinCode(f.content);
    const decl = /\b(?:fun|class|object|interface|typealias|val|var)\s+(?:<[^>]*>\s*)?(?:[A-Za-z_][\w.]*\.)?([A-Z]\w*)/g;
    let m: RegExpExecArray | null;
    while ((m = decl.exec(code))) declared.add(m[1]);
  });
  kotlinFiles.forEach((f) => {
    const code = kotlinCode(f.content);
    if (/^\s*import\s+[\w.]+\.\*\s*$/m.test(code)) return;
    const imported = new Set<string>();
    code.replace(/^\s*import\s+[\w.]+?\.([A-Za-z_]\w*)(?:\s+as\s+([A-Za-z_]\w*))?\s*$/gm, (_all, name: string, alias?: string) => {
      imported.add(alias || name);
      return "";
    });
    const lines = code.split(/\r?\n/);
    const seen = new Set<string>();
    lines.forEach((line, idx) => {
      if (/^\s*(?:package|import)\b/.test(line)) return;
      const call = /(^|[^\w.@:$])([A-Z]\w*)\s*(?:<[^>()]*>)?\s*[({]/g;
      let m: RegExpExecArray | null;
      while ((m = call.exec(line))) {
        const name = m[2];
        if (declared.has(name) || imported.has(name) || KOTLIN_IMPLICIT_CALLS.has(name) || seen.has(name)) continue;
        // `class Foo(` / `fun Foo(` declarations and `: Base(` supertypes of declared classes are handled above.
        seen.add(name);
        problems.push({
          id: `${f.id}-unresolved-${name}`,
          fileId: f.id,
          fileName: f.tabTitle,
          line: idx + 1,
          column: m.index + m[1].length + 1,
          severity: "error",
          message: `Unresolved reference: ${name}`,
        });
      }
    });
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
          timestamp: logcatTime(start + 0),
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
          timestamp: logcatTime(start + 0),
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
          timestamp: logcatTime(start + 90),
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
    timestamp: logcatTime(start + 320),
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
  const parts = trimmed.split(/\s+/);
  const bin = parts[0].toLowerCase();
  const arg = parts.slice(1).join(" ").trim();
  const lower = trimmed.toLowerCase();

  if (lower === "clear" || lower === "cls") {
    return { lines: [], clear: true };
  }
  if (lower === "pwd") {
    return { lines: [`~/AndroidStudioProjects/${preset.name}`] };
  }
  if (bin === "ls" || bin === "dir") {
    const prefix = arg ? arg.replace(/\/+$/, "") + "/" : "";
    const entries: string[] = [];
    for (let i = 0; i < preset.files.length; i++) {
      const p = preset.files[i].path;
      if (p.indexOf(prefix) === 0) {
        const rest = p.slice(prefix.length);
        const firstSeg = rest.indexOf("/") >= 0 ? rest.slice(0, rest.indexOf("/") + 1) : rest;
        if (firstSeg && entries.indexOf(firstSeg) < 0) entries.push(firstSeg);
      }
    }
    const folders = preset.folders || [];
    for (let i = 0; i < folders.length; i++) {
      const f = folders[i];
      if (f.indexOf(prefix) === 0) {
        const rest = f.slice(prefix.length);
        const firstSeg = rest.indexOf("/") >= 0 ? rest.slice(0, rest.indexOf("/") + 1) : rest + "/";
        if (firstSeg && entries.indexOf(firstSeg) < 0) entries.push(firstSeg);
      }
    }
    entries.sort();
    return {
      lines: entries.length > 0 ? [entries.join("    ")] : [`ls: cannot access '${arg}': No such file or directory`],
    };
  }
  if (bin === "cat") {
    if (!arg) return { lines: ["usage: cat <project-relative-path>"] };
    const found = preset.files.find(
      (f) => f.path === arg || f.name === arg || f.tabTitle === arg
    );
    if (!found) {
      return { lines: [`cat: ${arg}: No such file in project`] };
    }
    return { lines: found.content.replace(/\r\n/g, "\n").split("\n") };
  }
  if (lower === "git status") {
    const changes = computeProjectGitStatus(preset.files, preset.snapshotFiles);
    if (changes.length === 0) {
      return {
        lines: [
          `On branch ${preset.branch}`,
          "nothing to commit, working tree clean",
        ],
      };
    }
    return {
      lines: [
        `On branch ${preset.branch}`,
        "Changes not staged for commit:",
        ...changes.map((c) => `  ${c.status}:   ${c.path}`),
      ],
    };
  }
  if (lower === "adb devices") {
    const active = devices.filter((d) => d.booted);
    const rows = ["List of devices attached"];
    active.forEach((d) => {
      rows.push(`${d.adbSerial}\tdevice\t(Browser Android Runtime)`);
    });
    if (active.length === 0) {
      rows.push("(no active virtual device — start one from Device Manager)");
    }
    return { lines: rows };
  }
  if (
    lower === "./gradlew assembledebug" ||
    lower === "gradlew assembledebug" ||
    lower === "./gradlew compiledebugjava" ||
    lower === "gradlew compiledebugjava"
  ) {
    const problems = analyzeStudioProblems(preset.files).filter((p) => p.severity === "error");
    if (problems.length > 0) {
      return {
        lines: [
          "> Task :app:mergeDebugResources",
          ...problems.map((p) => `e: ${p.fileName}:${p.line}:${p.column}: ${p.message}`),
          "",
          "BUILD FAILED",
        ],
      };
    }
    return {
      lines: [
        "> Task :app:preBuild UP-TO-DATE",
        "> Task :app:mergeDebugResources",
        `> Task :app:compileDebug${preset.language === "kotlin" ? "Kotlin" : "JavaWithJavac"}`,
        "> Task :app:packageDebug",
        "> Task :app:assembleDebug",
        "",
        "BUILD SUCCESSFUL (local validation clean; use Build menu or signed-in session for isolated javac APK build)",
      ],
    };
  }
  if (lower === "./gradlew clean" || lower === "gradlew clean") {
    return { lines: ["> Task :app:clean", "BUILD SUCCESSFUL"] };
  }
  if (lower === "./gradlew test" || lower === "gradlew test") {
    const problems = analyzeStudioProblems(preset.files).filter((p) => p.severity === "error");
    if (problems.length > 0) {
      return {
        lines: [
          ...problems.map((p) => `e: ${p.fileName}:${p.line}:${p.column}: ${p.message}`),
          "BUILD FAILED",
        ],
      };
    }
    return {
      lines: [
        "> Task :app:compileDebugUnitTestSources",
        "> Task :app:testDebugUnitTest",
        "Validation checks passed.",
      ],
    };
  }
  if (lower === "help") {
    return {
      lines: [
        "Available commands: pwd, ls [dir], cat <file>, git status, adb devices, ./gradlew assembleDebug, ./gradlew test, ./gradlew clean, clear",
      ],
    };
  }
  return {
    lines: [`sh: ${trimmed}: command not found. Type 'help' for supported commands.`],
  };
}
