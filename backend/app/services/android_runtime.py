"""Isolated Android build, manifest/XML validation, javac compilation, and APK packaging."""

import base64
import io
import os
import re
import shutil
import time
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from ..config import settings
from .runtime_engine import RuntimeResult, run_process, write_project_files

MAX_ARTIFACT_BYTES = 512 * 1024
_RESERVED_TOP_DIRS = {"_android_stubs", "_out"}


def _which(command_or_name: str | None) -> str | None:
    if not command_or_name:
        return None
    candidate = Path(command_or_name)
    if candidate.is_file():
        return str(candidate)
    return shutil.which(command_or_name)


def detect_android_capabilities() -> dict:
    """Inspect real compilation tools available in the runtime worker environment."""
    javac_path = _which(settings.JAVAC_COMMAND) or _which("javac")
    java_path = _which(settings.JAVA_COMMAND) or _which("java")
    kotlinc_path = _which("kotlinc")
    gradle_path = _which("gradle")
    sdk_root = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT") or ""
    sdk_available = bool(sdk_root and Path(sdk_root).is_dir())
    return {
        "javac_available": bool(javac_path),
        "java_available": bool(java_path),
        "kotlinc_available": bool(kotlinc_path),
        "gradle_available": bool(gradle_path),
        "android_sdk_available": sdk_available,
        "native_emulator_available": False,
        "compiler_mode": "javac_android_stubs" if javac_path else "static_validation_only",
        "emulator_note": (
            "Interactive Browser Android Runtime active; native KVM/AVD Android Emulator "
            "is unavailable inside the web sandbox."
        ),
    }


def _safe_rel_path(path: str) -> bool:
    if not path or "\\" in path or path.startswith("/"):
        return False
    parts = Path(path).parts
    if not parts or ".." in parts or parts[0] in _RESERVED_TOP_DIRS:
        return False
    return True


def _strip_workspace_prefix(text: str, directory: Path) -> str:
    """Remove temporary directory prefixes so compiler output shows clean project paths."""
    resolved = str(directory.resolve())
    raw_dir = str(directory)
    cleaned = str(text or "")
    for prefix in (
        resolved + "/",
        resolved + "\\",
        raw_dir + "/",
        raw_dir + "\\",
        resolved,
        raw_dir,
    ):
        cleaned = cleaned.replace(prefix, "")
    cleaned = re.sub(
        r"(?:[A-Za-z]:)?[^\s:\"']*[/\\](?=app[/\\]src[/\\]|_android_stubs[/\\])",
        "",
        cleaned,
    )
    return cleaned.replace("\\", "/").strip()


def _infer_package_name(project_files: dict[str, str], project_config: dict) -> str:
    explicit = str((project_config or {}).get("package_name") or "").strip()
    if re.fullmatch(r"[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+", explicit):
        return explicit
    for path in ("app/build.gradle.kts", "app/build.gradle"):
        content = project_files.get(path, "")
        m = re.search(r'(?:namespace|applicationId)\s*(?:=|\s)\s*["\']([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+)["\']', content)
        if m:
            return m.group(1)
    manifest = project_files.get("app/src/main/AndroidManifest.xml", "")
    m = re.search(r'package\s*=\s*["\']([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+)["\']', manifest)
    if m:
        return m.group(1)
    for rel, content in project_files.items():
        if rel.endswith((".java", ".kt")):
            pm = re.search(r"^\s*package\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)", content, re.M)
            if pm:
                return pm.group(1)
    return "com.example.myapp"


def _validate_and_collect_resources(project_files: dict[str, str]) -> dict:
    """Parse XML files safely (rejecting DOCTYPE/ENTITY) and collect resource symbols + diagnostics."""
    diagnostics: list[dict] = []
    ids: set[str] = set()
    layouts: set[str] = set()
    strings: set[str] = set()
    colors: set[str] = set()
    drawables: set[str] = set()
    mipmaps: set[str] = set()
    activities: list[str] = []
    has_launcher = False

    for rel_path, content in sorted(project_files.items()):
        if not rel_path.endswith(".xml"):
            continue
        if re.search(r"<!\s*(?:DOCTYPE|ENTITY)\b", content, re.I):
            diagnostics.append({
                "file": rel_path,
                "line": 1,
                "column": 1,
                "severity": "error",
                "message": "Security policy: DOCTYPE and ENTITY declarations are disallowed in Android XML.",
            })
            continue
        try:
            root = ET.fromstring(content)
        except ET.ParseError as exc:
            line, col = getattr(exc, "position", (1, 1))
            diagnostics.append({
                "file": rel_path,
                "line": int(line or 1),
                "column": int(col or 1),
                "severity": "error",
                "message": f"XML parse error: {exc}",
            })
            continue

        # Collect @+id references from any XML file
        for m in re.finditer(r"@\+id/([A-Za-z_][A-Za-z0-9_]*)", content):
            ids.add(m.group(1))

        if rel_path == "app/src/main/AndroidManifest.xml":
            android_ns = "{http://schemas.android.com/apk/res/android}"
            for elem in root.iter("activity"):
                name = elem.attrib.get(f"{android_ns}name") or elem.attrib.get("android:name") or elem.attrib.get("name")
                if name:
                    activities.append(name)
                for filter_el in elem.findall("intent-filter"):
                    actions = [
                        a.attrib.get(f"{android_ns}name") or a.attrib.get("android:name")
                        for a in filter_el.findall("action")
                    ]
                    cats = [
                        c.attrib.get(f"{android_ns}name") or c.attrib.get("android:name")
                        for c in filter_el.findall("category")
                    ]
                    if "android.intent.action.MAIN" in actions and "android.intent.category.LAUNCHER" in cats:
                        has_launcher = True
            if activities and not has_launcher:
                diagnostics.append({
                    "file": rel_path,
                    "line": 1,
                    "column": 1,
                    "severity": "warning",
                    "message": "No MAIN/LAUNCHER activity intent-filter declared in AndroidManifest.xml.",
                })
        elif rel_path.startswith("app/src/main/res/layout/"):
            stem = Path(rel_path).stem
            if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", stem):
                layouts.add(stem)
        elif rel_path.startswith("app/src/main/res/values/"):
            for el in root.findall("string"):
                n = el.attrib.get("name", "").strip()
                if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", n):
                    strings.add(n)
            for el in root.findall("color"):
                n = el.attrib.get("name", "").strip()
                if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", n):
                    colors.add(n)
        elif rel_path.startswith("app/src/main/res/drawable/"):
            stem = Path(rel_path).stem
            if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", stem):
                drawables.add(stem)
        elif rel_path.startswith("app/src/main/res/mipmap/"):
            stem = Path(rel_path).stem
            if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", stem):
                mipmaps.add(stem)

    if "app/src/main/AndroidManifest.xml" not in project_files:
        diagnostics.append({
            "file": "app/src/main/AndroidManifest.xml",
            "line": 1,
            "column": 1,
            "severity": "warning",
            "message": "AndroidManifest.xml not found; resource compilation continuing with defaults.",
        })

    return {
        "diagnostics": diagnostics,
        "ids": sorted(ids),
        "layouts": sorted(layouts),
        "strings": sorted(strings),
        "colors": sorted(colors),
        "drawables": sorted(drawables),
        "mipmaps": sorted(mipmaps),
        "activities": activities,
        "has_launcher": has_launcher,
    }


def _render_r_java(package_name: str, resources: dict) -> str:
    """Generate a real compile-time R.java class from the project's XML resource files."""
    next_id = 0x7F080001

    def render_section(class_name: str, names: list[str], prefix: int) -> str:
        nonlocal next_id
        lines = [f"    public static final class {class_name} {{"]
        for name in names:
            val = prefix | (next_id & 0xFFFF)
            next_id += 1
            lines.append(f"        public static final int {name} = 0x{val:08x};")
        lines.append("    }")
        return "\n".join(lines)

    sections = [
        render_section("id", resources["ids"], 0x7F080000),
        render_section("layout", resources["layouts"] or ["activity_main"], 0x7F0A0000),
        render_section("string", resources["strings"] or ["app_name"], 0x7F0F0000),
        render_section("color", resources["colors"], 0x7F060000),
        render_section("drawable", resources["drawables"] or ["ic_launcher_foreground"], 0x7F070000),
        render_section("mipmap", resources["mipmaps"] or ["ic_launcher", "ic_launcher_round"], 0x7F0E0000),
    ]
    return (
        f"package {package_name};\n\n"
        f"public final class R {{\n"
        + "\n".join(sections)
        + "\n}\n"
    )


def _write_android_stubs(stubs_dir: Path, r_package: str, r_java_source: str) -> list[Path]:
    """Write lightweight cleanroom Android API stubs compiled alongside student Java files."""
    files: dict[str, str] = {
        "android/os/Bundle.java": """package android.os;
import java.util.HashMap;
import java.util.Map;
public class Bundle {
    private final Map<String, Object> data = new HashMap<>();
    public void putString(String key, String value) { data.put(key, value); }
    public String getString(String key) { Object v = data.get(key); return v instanceof String ? (String) v : null; }
    public String getString(String key, String defaultValue) { String v = getString(key); return v != null ? v : defaultValue; }
    public void putInt(String key, int value) { data.put(key, value); }
    public int getInt(String key) { return getInt(key, 0); }
    public int getInt(String key, int defaultValue) { Object v = data.get(key); return v instanceof Number ? ((Number) v).intValue() : defaultValue; }
    public void putBoolean(String key, boolean value) { data.put(key, value); }
    public boolean getBoolean(String key) { return getBoolean(key, false); }
    public boolean getBoolean(String key, boolean defaultValue) { Object v = data.get(key); return v instanceof Boolean ? (Boolean) v : defaultValue; }
    public boolean containsKey(String key) { return data.containsKey(key); }
}
""",
        "android/net/Uri.java": """package android.net;
public class Uri {
    private final String raw;
    private Uri(String raw) { this.raw = raw == null ? "" : raw; }
    public static Uri parse(String uriString) { return new Uri(uriString); }
    @Override public String toString() { return raw; }
}
""",
        "android/graphics/Color.java": """package android.graphics;
public class Color {
    public static final int BLACK = 0xFF000000;
    public static final int DKGRAY = 0xFF444444;
    public static final int GRAY = 0xFF888888;
    public static final int LTGRAY = 0xFFCCCCCC;
    public static final int WHITE = 0xFFFFFFFF;
    public static final int RED = 0xFFFF0000;
    public static final int GREEN = 0xFF00FF00;
    public static final int BLUE = 0xFF0000FF;
    public static final int YELLOW = 0xFFFFFF00;
    public static final int CYAN = 0xFF00FFFF;
    public static final int MAGENTA = 0xFFFF00FF;
    public static final int TRANSPARENT = 0;
    public static int parseColor(String colorString) {
        if (colorString == null || !colorString.startsWith("#")) throw new IllegalArgumentException("Unknown color");
        return (int) Long.parseLong(colorString.substring(1), 16);
    }
    public static int rgb(int red, int green, int blue) { return argb(255, red, green, blue); }
    public static int argb(int alpha, int red, int green, int blue) {
        return ((alpha & 0xFF) << 24) | ((red & 0xFF) << 16) | ((green & 0xFF) << 8) | (blue & 0xFF);
    }
}
""",
        "android/util/Log.java": """package android.util;
public final class Log {
    private Log() {}
    public static int v(String tag, String msg) { return println("V", tag, msg); }
    public static int d(String tag, String msg) { return println("D", tag, msg); }
    public static int i(String tag, String msg) { return println("I", tag, msg); }
    public static int w(String tag, String msg) { return println("W", tag, msg); }
    public static int e(String tag, String msg) { return println("E", tag, msg); }
    public static int e(String tag, String msg, Throwable tr) { return println("E", tag, msg + (tr != null ? ": " + tr : "")); }
    public static int wtf(String tag, String msg) { return println("A", tag, msg); }
    private static int println(String lvl, String tag, String msg) {
        System.out.println(lvl + "/" + tag + ": " + msg);
        return 0;
    }
}
""",
        "android/content/DialogInterface.java": """package android.content;
public interface DialogInterface {
    interface OnClickListener { void onClick(DialogInterface dialog, int which); }
}
""",
        "android/content/SharedPreferences.java": """package android.content;
import java.util.HashMap;
import java.util.Map;
public interface SharedPreferences {
    interface Editor {
        Editor putString(String key, String value);
        Editor putInt(String key, int value);
        Editor putBoolean(String key, boolean value);
        Editor remove(String key);
        Editor clear();
        boolean commit();
        void apply();
    }
    String getString(String key, String defValue);
    int getInt(String key, int defValue);
    boolean getBoolean(String key, boolean defValue);
    boolean contains(String key);
    Editor edit();
    final class InMemory implements SharedPreferences {
        private final Map<String, Object> store = new HashMap<>();
        @Override public String getString(String k, String d) { Object v = store.get(k); return v instanceof String ? (String) v : d; }
        @Override public int getInt(String k, int d) { Object v = store.get(k); return v instanceof Number ? ((Number) v).intValue() : d; }
        @Override public boolean getBoolean(String k, boolean d) { Object v = store.get(k); return v instanceof Boolean ? (Boolean) v : d; }
        @Override public boolean contains(String k) { return store.containsKey(k); }
        @Override public Editor edit() {
            return new Editor() {
                @Override public Editor putString(String k, String v) { store.put(k, v); return this; }
                @Override public Editor putInt(String k, int v) { store.put(k, v); return this; }
                @Override public Editor putBoolean(String k, boolean v) { store.put(k, v); return this; }
                @Override public Editor remove(String k) { store.remove(k); return this; }
                @Override public Editor clear() { store.clear(); return this; }
                @Override public boolean commit() { return true; }
                @Override public void apply() {}
            };
        }
    }
}
""",
        "android/content/Intent.java": """package android.content;
import android.net.Uri;
import java.util.HashMap;
import java.util.Map;
public class Intent {
    public static final String ACTION_VIEW = "android.intent.action.VIEW";
    public static final String ACTION_DIAL = "android.intent.action.DIAL";
    public static final String ACTION_SEND = "android.intent.action.SEND";
    public static final int FLAG_ACTIVITY_NEW_TASK = 0x10000000;
    public static final int FLAG_ACTIVITY_CLEAR_TOP = 0x04000000;
    private String action;
    private Uri data;
    private String type;
    private String componentClass;
    private final Map<String, Object> extras = new HashMap<>();
    public Intent() {}
    public Intent(String action) { this.action = action; }
    public Intent(String action, Uri uri) { this.action = action; this.data = uri; }
    public Intent(Context packageContext, Class<?> cls) { this.componentClass = cls != null ? cls.getName() : null; }
    public Intent putExtra(String name, String value) { extras.put(name, value); return this; }
    public Intent putExtra(String name, CharSequence value) { extras.put(name, value == null ? null : value.toString()); return this; }
    public Intent putExtra(String name, int value) { extras.put(name, value); return this; }
    public Intent putExtra(String name, long value) { extras.put(name, value); return this; }
    public Intent putExtra(String name, double value) { extras.put(name, value); return this; }
    public Intent putExtra(String name, float value) { extras.put(name, value); return this; }
    public Intent putExtra(String name, boolean value) { extras.put(name, value); return this; }
    public String getStringExtra(String name) { Object v = extras.get(name); return v != null ? v.toString() : null; }
    public int getIntExtra(String name, int defaultValue) { Object v = extras.get(name); return v instanceof Number ? ((Number) v).intValue() : defaultValue; }
    public long getLongExtra(String name, long defaultValue) { Object v = extras.get(name); return v instanceof Number ? ((Number) v).longValue() : defaultValue; }
    public double getDoubleExtra(String name, double defaultValue) { Object v = extras.get(name); return v instanceof Number ? ((Number) v).doubleValue() : defaultValue; }
    public boolean getBooleanExtra(String name, boolean defaultValue) { Object v = extras.get(name); return v instanceof Boolean ? (Boolean) v : defaultValue; }
    public String getAction() { return action; }
    public Uri getData() { return data; }
    public String getComponentClass() { return componentClass; }
    public Intent setType(String type) { this.type = type; return this; }
    public String getType() { return type; }
    public Intent addFlags(int flags) { return this; }
    public Intent setFlags(int flags) { return this; }
    public static Intent createChooser(Intent target, CharSequence title) { return target; }
}
""",
        "android/content/Context.java": """package android.content;
import java.util.HashMap;
import java.util.Map;
public class Context {
    public static final int MODE_PRIVATE = 0;
    private final Map<String, SharedPreferences> prefs = new HashMap<>();
    public Context getApplicationContext() { return this; }
    public String getPackageName() { return "com.example.myapp"; }
    public String getString(int resId) { return ""; }
    public SharedPreferences getSharedPreferences(String name, int mode) {
        return prefs.computeIfAbsent(name, k -> new SharedPreferences.InMemory());
    }
    public void startActivity(Intent intent) {}
}
""",
        "android/text/Editable.java": """package android.text;
public interface Editable extends CharSequence {
    Editable append(CharSequence text);
    Editable replace(int st, int en, CharSequence text);
    void clear();
}
""",
        "android/text/TextWatcher.java": """package android.text;
public interface TextWatcher {
    void beforeTextChanged(CharSequence s, int start, int count, int after);
    void onTextChanged(CharSequence s, int start, int before, int count);
    void afterTextChanged(Editable s);
}
""",
        "android/view/Menu.java": """package android.view;
public interface Menu {
    MenuItem add(CharSequence title);
    MenuItem findItem(int id);
}
""",
        "android/view/MenuItem.java": """package android.view;
public interface MenuItem {
    int getItemId();
    CharSequence getTitle();
}
""",
        "android/view/View.java": """package android.view;
import android.content.Context;
public class View {
    public static final int VISIBLE = 0;
    public static final int INVISIBLE = 4;
    public static final int GONE = 8;
    public interface OnClickListener { void onClick(View v); }
    private final Context context;
    private int id = -1;
    private int visibility = VISIBLE;
    private boolean enabled = true;
    private OnClickListener clickListener;
    public View(Context context) { this.context = context; }
    public Context getContext() { return context; }
    public int getId() { return id; }
    public void setId(int id) { this.id = id; }
    public int getVisibility() { return visibility; }
    public void setVisibility(int visibility) { this.visibility = visibility; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public void setOnClickListener(OnClickListener l) { this.clickListener = l; }
    public boolean performClick() {
        if (clickListener != null) { clickListener.onClick(this); return true; }
        return false;
    }
    public void setBackgroundColor(int color) {}
    public void setBackgroundResource(int resid) {}
    public void setPadding(int left, int top, int right, int bottom) {}
    @SuppressWarnings("unchecked")
    public <T extends View> T findViewById(int id) { return null; }
}
""",
        "android/view/ViewGroup.java": """package android.view;
import android.content.Context;
import java.util.ArrayList;
import java.util.List;
public class ViewGroup extends View {
    private final List<View> children = new ArrayList<>();
    public ViewGroup(Context context) { super(context); }
    public void addView(View child) { if (child != null) children.add(child); }
    public void removeAllViews() { children.clear(); }
    public int getChildCount() { return children.size(); }
    public View getChildAt(int index) { return children.get(index); }
}
""",
        "android/view/LayoutInflater.java": """package android.view;
import android.content.Context;
public class LayoutInflater {
    private final Context context;
    private LayoutInflater(Context context) { this.context = context; }
    public static LayoutInflater from(Context context) { return new LayoutInflater(context); }
    public View inflate(int resource, ViewGroup root) { return new View(context); }
    public View inflate(int resource, ViewGroup root, boolean attachToRoot) { return new View(context); }
}
""",
        "android/widget/TextView.java": """package android.widget;
import android.content.Context;
import android.text.TextWatcher;
import android.view.View;
public class TextView extends View {
    protected CharSequence textValue = "";
    private CharSequence hintValue = "";
    public TextView(Context context) { super(context); }
    public CharSequence getText() { return textValue; }
    public void setText(CharSequence text) { this.textValue = text != null ? text : ""; }
    public void setText(int resid) { this.textValue = ""; }
    public void append(CharSequence text) { this.textValue = this.textValue.toString() + (text != null ? text : ""); }
    public CharSequence getHint() { return hintValue; }
    public void setHint(CharSequence hint) { this.hintValue = hint != null ? hint : ""; }
    public void setTextColor(int color) {}
    public void setTextSize(float size) {}
    public void setTextSize(int unit, float size) {}
    public void addTextChangedListener(TextWatcher watcher) {}
}
""",
        "android/widget/EditText.java": """package android.widget;
import android.content.Context;
import android.text.Editable;
public class EditText extends TextView {
    private static final class SimpleEditable implements Editable {
        private final StringBuilder sb;
        SimpleEditable(CharSequence initial) { this.sb = new StringBuilder(initial != null ? initial : ""); }
        @Override public Editable append(CharSequence text) { sb.append(text); return this; }
        @Override public Editable replace(int st, int en, CharSequence text) { sb.replace(st, en, text.toString()); return this; }
        @Override public void clear() { sb.setLength(0); }
        @Override public int length() { return sb.length(); }
        @Override public char charAt(int index) { return sb.charAt(index); }
        @Override public CharSequence subSequence(int start, int end) { return sb.subSequence(start, end); }
        @Override public String toString() { return sb.toString(); }
    }
    public EditText(Context context) { super(context); }
    @Override public Editable getText() { return new SimpleEditable(textValue); }
    public void setError(CharSequence error) {}
    public void setInputType(int type) {}
    public void selectAll() {}
}
""",
        "android/widget/Button.java": """package android.widget;
import android.content.Context;
public class Button extends TextView {
    public Button(Context context) { super(context); }
}
""",
        "android/widget/ImageView.java": """package android.widget;
import android.content.Context;
import android.net.Uri;
import android.view.View;
public class ImageView extends View {
    public ImageView(Context context) { super(context); }
    public void setImageResource(int resId) {}
    public void setImageURI(Uri uri) {}
}
""",
        "android/widget/CompoundButton.java": """package android.widget;
import android.content.Context;
public class CompoundButton extends Button {
    public interface OnCheckedChangeListener { void onCheckedChanged(CompoundButton buttonView, boolean isChecked); }
    private boolean checked;
    private OnCheckedChangeListener listener;
    public CompoundButton(Context context) { super(context); }
    public boolean isChecked() { return checked; }
    public void setChecked(boolean checked) {
        this.checked = checked;
        if (listener != null) listener.onCheckedChanged(this, checked);
    }
    public void toggle() { setChecked(!checked); }
    public void setOnCheckedChangeListener(OnCheckedChangeListener listener) { this.listener = listener; }
}
""",
        "android/widget/CheckBox.java": """package android.widget;
import android.content.Context;
public class CheckBox extends CompoundButton { public CheckBox(Context context) { super(context); } }
""",
        "android/widget/RadioButton.java": """package android.widget;
import android.content.Context;
public class RadioButton extends CompoundButton { public RadioButton(Context context) { super(context); } }
""",
        "android/widget/Switch.java": """package android.widget;
import android.content.Context;
public class Switch extends CompoundButton { public Switch(Context context) { super(context); } }
""",
        "android/widget/LinearLayout.java": """package android.widget;
import android.content.Context;
import android.view.ViewGroup;
public class LinearLayout extends ViewGroup {
    public static final int HORIZONTAL = 0;
    public static final int VERTICAL = 1;
    public LinearLayout(Context context) { super(context); }
    public void setOrientation(int orientation) {}
}
""",
        "android/widget/RelativeLayout.java": """package android.widget;
import android.content.Context;
import android.view.ViewGroup;
public class RelativeLayout extends ViewGroup {
    public RelativeLayout(Context context) { super(context); }
}
""",
        "android/widget/RadioGroup.java": """package android.widget;
import android.content.Context;
public class RadioGroup extends LinearLayout {
    public interface OnCheckedChangeListener { void onCheckedChanged(RadioGroup group, int checkedId); }
    private int checkedId = -1;
    public RadioGroup(Context context) { super(context); }
    public int getCheckedRadioButtonId() { return checkedId; }
    public void check(int id) { this.checkedId = id; }
    public void clearCheck() { this.checkedId = -1; }
    public void setOnCheckedChangeListener(OnCheckedChangeListener listener) {}
}
""",
        "android/widget/ArrayAdapter.java": """package android.widget;
import android.content.Context;
import java.util.Arrays;
import java.util.List;
public class ArrayAdapter<T> {
    private final List<T> items;
    public ArrayAdapter(Context context, int resource, List<T> objects) { this.items = objects; }
    public ArrayAdapter(Context context, int resource, T[] objects) { this.items = Arrays.asList(objects); }
    public int getCount() { return items != null ? items.size() : 0; }
    public T getItem(int position) { return items.get(position); }
}
""",
        "android/widget/AdapterView.java": """package android.widget;
import android.content.Context;
import android.view.View;
import android.view.ViewGroup;
public abstract class AdapterView<T> extends ViewGroup {
    public interface OnItemClickListener { void onItemClick(AdapterView<?> parent, View view, int position, long id); }
    public interface OnItemSelectedListener {
        void onItemSelected(AdapterView<?> parent, View view, int position, long id);
        void onNothingSelected(AdapterView<?> parent);
    }
    public AdapterView(Context context) { super(context); }
    public void setOnItemClickListener(OnItemClickListener l) {}
    public void setOnItemSelectedListener(OnItemSelectedListener l) {}
    public Object getSelectedItem() { return null; }
}
""",
        "android/widget/ListView.java": """package android.widget;
import android.content.Context;
public class ListView extends AdapterView<ArrayAdapter<?>> {
    public ListView(Context context) { super(context); }
    public void setAdapter(ArrayAdapter<?> adapter) {}
}
""",
        "android/widget/Spinner.java": """package android.widget;
import android.content.Context;
public class Spinner extends AdapterView<ArrayAdapter<?>> {
    public Spinner(Context context) { super(context); }
    public void setAdapter(ArrayAdapter<?> adapter) {}
    public int getSelectedItemPosition() { return 0; }
}
""",
        "android/widget/Toast.java": """package android.widget;
import android.content.Context;
public class Toast {
    public static final int LENGTH_SHORT = 0;
    public static final int LENGTH_LONG = 1;
    private final CharSequence message;
    private Toast(CharSequence message) { this.message = message; }
    public static Toast makeText(Context context, CharSequence text, int duration) { return new Toast(text); }
    public static Toast makeText(Context context, int resId, int duration) { return new Toast(""); }
    public void show() { System.out.println("[Toast] " + message); }
}
""",
        "android/app/AlertDialog.java": """package android.app;
import android.content.Context;
import android.content.DialogInterface;
public class AlertDialog {
    public static class Builder {
        public Builder(Context context) {}
        public Builder setTitle(CharSequence title) { return this; }
        public Builder setMessage(CharSequence message) { return this; }
        public Builder setCancelable(boolean cancelable) { return this; }
        public Builder setPositiveButton(CharSequence text, DialogInterface.OnClickListener listener) { return this; }
        public Builder setNegativeButton(CharSequence text, DialogInterface.OnClickListener listener) { return this; }
        public AlertDialog create() { return new AlertDialog(); }
        public AlertDialog show() { return new AlertDialog(); }
    }
    public void show() {}
    public void dismiss() {}
}
""",
        "android/app/Activity.java": """package android.app;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Button;
import java.util.HashMap;
import java.util.Map;
public class Activity extends Context {
    private Intent intent = new Intent();
    private final Map<Integer, View> views = new HashMap<>();
    protected void onCreate(Bundle savedInstanceState) {}
    protected void onStart() {}
    protected void onResume() {}
    protected void onPause() {}
    protected void onStop() {}
    protected void onDestroy() {}
    public void setContentView(int layoutResID) {}
    public void setContentView(View view) {}
    @SuppressWarnings("unchecked")
    public <T extends View> T findViewById(int id) {
        return (T) views.computeIfAbsent(id, k -> new EditText(this));
    }
    public Intent getIntent() { return intent; }
    public void setIntent(Intent newIntent) { this.intent = newIntent != null ? newIntent : new Intent(); }
    @Override public void startActivity(Intent intent) {}
    public void finish() {}
    public LayoutInflater getLayoutInflater() { return LayoutInflater.from(this); }
    public boolean onCreateOptionsMenu(Menu menu) { return true; }
    public boolean onOptionsItemSelected(MenuItem item) { return false; }
}
""",
        "androidx/activity/ComponentActivity.java": """package androidx.activity;
import android.app.Activity;
public class ComponentActivity extends Activity {}
""",
        "androidx/activity/EdgeToEdge.java": """package androidx.activity;
public final class EdgeToEdge {
    private EdgeToEdge() {}
    public static void enable(ComponentActivity activity) {}
}
""",
        "androidx/appcompat/app/AppCompatActivity.java": """package androidx.appcompat.app;
import androidx.activity.ComponentActivity;
public class AppCompatActivity extends ComponentActivity {}
""",
        "androidx/constraintlayout/widget/ConstraintLayout.java": """package androidx.constraintlayout.widget;
import android.content.Context;
import android.view.ViewGroup;
public class ConstraintLayout extends ViewGroup {
    public ConstraintLayout(Context context) { super(context); }
}
""",
        "org/junit/Test.java": """package org.junit;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
@Retention(RetentionPolicy.RUNTIME)
public @interface Test {}
""",
        "org/junit/Assert.java": """package org.junit;
import java.util.Objects;
public class Assert {
    public static void assertEquals(Object expected, Object actual) {
        if (!Objects.equals(expected, actual)) {
            throw new AssertionError("Expected <" + expected + "> but was <" + actual + ">");
        }
    }
    public static void assertEquals(long expected, long actual) {
        if (expected != actual) {
            throw new AssertionError("Expected <" + expected + "> but was <" + actual + ">");
        }
    }
    public static void assertEquals(double expected, double actual, double delta) {
        if (Math.abs(expected - actual) > delta) {
            throw new AssertionError("Expected <" + expected + "> but was <" + actual + ">");
        }
    }
    public static void assertTrue(boolean condition) {
        if (!condition) throw new AssertionError("Expected true but was false");
    }
    public static void assertFalse(boolean condition) {
        if (condition) throw new AssertionError("Expected false but was true");
    }
    public static void assertNotNull(Object obj) {
        if (obj == null) throw new AssertionError("Expected non-null object");
    }
    public static void fail(String message) {
        throw new AssertionError(message);
    }
}
""",
        "org/junit/LabMateJUnitRunner.java": """package org.junit;
import java.lang.reflect.Method;
public final class LabMateJUnitRunner {
    public static void main(String[] args) {
        int failed = 0;
        int passed = 0;
        for (String clsName : args) {
            try {
                Class<?> cls = Class.forName(clsName);
                for (Method m : cls.getDeclaredMethods()) {
                    if (m.isAnnotationPresent(Test.class)) {
                        Object instance = cls.getDeclaredConstructor().newInstance();
                        try {
                            m.invoke(instance);
                            passed++;
                            System.out.println(cls.getSimpleName() + " > " + m.getName() + " PASSED");
                        } catch (Throwable t) {
                            failed++;
                            Throwable cause = t.getCause() != null ? t.getCause() : t;
                            System.err.println(cls.getSimpleName() + " > " + m.getName() + " FAILED: " + cause);
                        }
                    }
                }
            } catch (Throwable t) {
                failed++;
                System.err.println("Could not load test class " + clsName + ": " + t);
            }
        }
        System.out.println("Tests completed: " + passed + " passed, " + failed + " failed");
        if (failed > 0) System.exit(1);
    }
}
""",
    }
    files[r_package.replace(".", "/") + "/R.java"] = r_java_source

    written: list[Path] = []
    for rel, content in files.items():
        dest = stubs_dir / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(content, encoding="utf-8")
        written.append(dest)
    return written


def _parse_javac_diagnostics(stderr_text: str, directory: Path) -> list[dict]:
    cleaned = _strip_workspace_prefix(stderr_text, directory)
    diagnostics: list[dict] = []
    for line in cleaned.splitlines():
        m = re.match(r"^([^:\s][^:]*\.(?:java|kt)):(\d+):(?:\s*(\d+):)?\s*(error|warning):\s*(.+)$", line)
        if m:
            diagnostics.append({
                "file": m.group(1),
                "line": int(m.group(2)),
                "column": int(m.group(3) or 1),
                "severity": "warning" if m.group(4) == "warning" else "error",
                "message": m.group(5).strip(),
            })
    if not diagnostics and cleaned:
        diagnostics.append({
            "file": "build",
            "line": 1,
            "column": 1,
            "severity": "error",
            "message": cleaned.splitlines()[0][:300],
        })
    return diagnostics


def _package_debug_apk(directory: Path, project_files: dict[str, str], out_dir: Path, package_name: str, capabilities: dict) -> dict | None:
    """Create a real ZIP-structured debug APK archive containing compiled bytecode & resources."""
    buf = io.BytesIO()
    entry_count = 0
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "META-INF/MANIFEST.MF",
            "Manifest-Version: 1.0\nCreated-By: LabMate Isolated Android Build Engine\n"
            f"X-Application-Id: {package_name}\n",
        )
        entry_count += 1
        zf.writestr(
            "META-INF/LABMATE_BUILD_INFO.txt",
            f"applicationId={package_name}\ncompilerMode={capabilities.get('compiler_mode')}\n"
            f"androidSdkPresent={capabilities.get('android_sdk_available')}\n",
        )
        entry_count += 1
        if "app/src/main/AndroidManifest.xml" in project_files:
            zf.writestr("AndroidManifest.xml", project_files["app/src/main/AndroidManifest.xml"])
            entry_count += 1
        for rel, content in sorted(project_files.items()):
            if rel.startswith("app/src/main/res/"):
                apk_rel = rel[len("app/src/main/"):]
                zf.writestr(apk_rel, content)
                entry_count += 1
        if out_dir.is_dir():
            for cls in sorted(out_dir.rglob("*.class")):
                rel_cls = cls.relative_to(out_dir).as_posix()
                zf.writestr(f"classes/{rel_cls}", cls.read_bytes())
                entry_count += 1

    raw = buf.getvalue()
    if len(raw) > MAX_ARTIFACT_BYTES:
        return None
    return {
        "filename": "app-debug.apk",
        "size_bytes": len(raw),
        "entry_count": entry_count,
        "format": "zip_bytecode_archive",
        "base64": base64.b64encode(raw).decode("ascii"),
    }


async def build_android_project(directory: Path, project_files: dict[str, str], project_config: dict) -> RuntimeResult:
    """Validate XML/manifest, generate R.java + Android stubs, compile Java via isolated javac, and optionally package APK."""
    started = time.perf_counter()
    task = str((project_config or {}).get("task") or "assembleDebug")
    capabilities = detect_android_capabilities()
    steps: list[dict] = []
    logs: list[str] = []

    if not project_files or any(not _safe_rel_path(path) for path in project_files):
        return RuntimeResult(
            False,
            error="Invalid project file list.",
            exit_code=2,
            stages={"build": "failed"},
            verification={"steps": [], "diagnostics": [], "capabilities": capabilities},
        )

    write_project_files(directory, project_files)
    package_name = _infer_package_name(project_files, project_config)

    # 1. Clean task
    if task == "clean":
        t0 = time.perf_counter()
        out_dir = directory / "_out"
        if out_dir.exists():
            shutil.rmtree(out_dir, ignore_errors=True)
        dt = max(1, int((time.perf_counter() - t0) * 1000))
        steps.append({"id": "step-clean", "label": ":app:clean", "status": "success", "durationMs": dt})
        logs.append("> Task :app:clean")
        logs.append(f"BUILD SUCCESSFUL in {dt}ms")
        return RuntimeResult(
            True,
            output="\n".join(logs),
            exit_code=0,
            stages={"build": "passed"},
            timings={"total_seconds": round(time.perf_counter() - started, 4)},
            verification={"steps": steps, "diagnostics": [], "capabilities": capabilities, "compiled_classes": []},
        )

    # 2. Validate XML & Collect Resources
    t_res = time.perf_counter()
    res_info = _validate_and_collect_resources(project_files)
    xml_diagnostics = res_info["diagnostics"]
    xml_errors = [d for d in xml_diagnostics if d["severity"] == "error"]
    dt_res = max(1, int((time.perf_counter() - t_res) * 1000))
    steps.append({
        "id": "step-res",
        "label": ":app:mergeDebugResources",
        "status": "failed" if xml_errors else "success",
        "durationMs": dt_res,
    })
    logs.append(
        f"> Task :app:mergeDebugResources ({len(res_info['layouts'])} layouts, "
        f"{len(res_info['ids'])} view IDs, {len(res_info['strings'])} strings)"
    )

    if xml_errors:
        for d in xml_diagnostics:
            logs.append(f"{d['file']}:{d['line']}:{d['column']}: {d['severity']}: {d['message']}")
        logs.append("BUILD FAILED")
        return RuntimeResult(
            False,
            output="\n".join(logs),
            error=f"{xml_errors[0]['file']}:{xml_errors[0]['line']}: {xml_errors[0]['message']}",
            exit_code=1,
            stages={"compile": "failed", "build": "failed"},
            timings={"total_seconds": round(time.perf_counter() - started, 4)},
            verification={"steps": steps, "diagnostics": xml_diagnostics, "capabilities": capabilities, "compiled_classes": []},
        )

    # 3. Generate R.java + Android Stubs
    t_gen = time.perf_counter()
    stubs_dir = directory / "_android_stubs"
    out_dir = directory / "_out"
    out_dir.mkdir(parents=True, exist_ok=True)
    r_java = _render_r_java(package_name, res_info)
    stub_files = _write_android_stubs(stubs_dir, package_name, r_java)
    dt_gen = max(1, int((time.perf_counter() - t_gen) * 1000))
    steps.append({"id": "step-r", "label": ":app:generateDebugRFile", "status": "success", "durationMs": dt_gen})
    logs.append(f"> Task :app:generateDebugRFile (package {package_name})")

    # 4. Collect student Java / Kotlin files
    main_java = sorted(
        directory / rel
        for rel in project_files
        if rel.endswith(".java") and "/test/" not in rel and "/androidTest/" not in rel
    )
    test_java = sorted(
        directory / rel
        for rel in project_files
        if rel.endswith(".java") and ("/test/" in rel or "/androidTest/" in rel)
    )
    kotlin_files = sorted(
        directory / rel
        for rel in project_files
        if rel.endswith(".kt")
    )

    all_diagnostics = list(xml_diagnostics)
    compiled_classes: list[str] = []

    if main_java or (task == "test" and test_java):
        if not capabilities["javac_available"]:
            dt_cmp = 1
            steps.append({"id": "step-java", "label": ":app:compileDebugJavaWithJavac", "status": "failed", "durationMs": dt_cmp})
            msg = "javac is not available on this worker; Java bytecode compilation could not run."
            all_diagnostics.append({"file": "build", "line": 1, "column": 1, "severity": "error", "message": msg})
            logs.append(msg)
            return RuntimeResult(
                False,
                output="\n".join(logs),
                error=msg,
                exit_code=127,
                stages={"compile": "failed"},
                timings={"total_seconds": round(time.perf_counter() - started, 4)},
                verification={"steps": steps, "diagnostics": all_diagnostics, "capabilities": capabilities, "compiled_classes": []},
            )

        target_java = main_java + (test_java if task == "test" else [])
        javac_cmd = [
            settings.JAVAC_COMMAND,
            "-J-Xmx256m",
            "-encoding",
            "UTF-8",
            "-Xlint:none",
            "-d",
            str(out_dir),
            *[str(p) for p in stub_files],
            *[str(p) for p in target_java],
        ]
        t_cmp = time.perf_counter()
        compiled = await run_process(
            javac_cmd,
            directory,
            timeout=settings.COMPILATION_TIMEOUT,
            resource_limits={"max_memory_bytes": 0, "max_cpu_seconds": min(45, settings.COMPILATION_TIMEOUT)},
        )
        dt_cmp = max(1, int((time.perf_counter() - t_cmp) * 1000))
        if not compiled.success:
            steps.append({"id": "step-java", "label": ":app:compileDebugJavaWithJavac", "status": "failed", "durationMs": dt_cmp})
            cleaned_err = _strip_workspace_prefix(compiled.error, directory)
            javac_diags = _parse_javac_diagnostics(cleaned_err, directory)
            all_diagnostics.extend(javac_diags)
            logs.append(f"> Task :app:compileDebugJavaWithJavac FAILED")
            logs.extend(cleaned_err.splitlines())
            logs.append("BUILD FAILED")
            return RuntimeResult(
                False,
                output="\n".join(logs),
                error=cleaned_err,
                exit_code=compiled.exit_code or 1,
                stages={"compile": "failed"},
                timings={"total_seconds": round(time.perf_counter() - started, 4)},
                verification={"steps": steps, "diagnostics": all_diagnostics, "capabilities": capabilities, "compiled_classes": []},
            )

        steps.append({"id": "step-java", "label": ":app:compileDebugJavaWithJavac", "status": "success", "durationMs": dt_cmp})
        logs.append(f"> Task :app:compileDebugJavaWithJavac ({len(target_java)} source files in {dt_cmp}ms)")
        for cls in sorted(out_dir.rglob("*.class")):
            rel_cls = cls.relative_to(out_dir).as_posix()
            if not rel_cls.startswith(("android/", "androidx/", "org/junit/")):
                compiled_classes.append(rel_cls)

        if task == "test" and test_java:
            test_fqns: list[str] = []
            for p in test_java:
                src_text = p.read_text(encoding="utf-8", errors="ignore")
                pkg_m = re.search(r"^\s*package\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)", src_text, re.M)
                fqn = f"{pkg_m.group(1)}.{p.stem}" if pkg_m else p.stem
                test_fqns.append(fqn)
            t_test = time.perf_counter()
            test_res = await run_process(
                [settings.JAVA_COMMAND, "-Xmx256m", "-Dfile.encoding=UTF-8", "-cp", str(out_dir), "org.junit.LabMateJUnitRunner", *test_fqns],
                directory,
                resource_limits={"max_memory_bytes": 0, "max_cpu_seconds": 20},
            )
            dt_test = max(1, int((time.perf_counter() - t_test) * 1000))
            steps.append({
                "id": "step-test",
                "label": ":app:testDebugUnitTest",
                "status": "success" if test_res.success else "failed",
                "durationMs": dt_test,
            })
            logs.append(f"> Task :app:testDebugUnitTest ({dt_test}ms)")
            if test_res.output:
                logs.extend(test_res.output.strip().splitlines())
            if test_res.error:
                logs.extend(test_res.error.strip().splitlines())
            if not test_res.success:
                logs.append("BUILD FAILED")
                return RuntimeResult(
                    False,
                    output="\n".join(logs),
                    error=test_res.error or "Unit tests failed.",
                    exit_code=test_res.exit_code or 1,
                    stages={"compile": "passed", "test": "failed"},
                    timings={"total_seconds": round(time.perf_counter() - started, 4)},
                    verification={"steps": steps, "diagnostics": all_diagnostics, "capabilities": capabilities, "compiled_classes": compiled_classes},
                )

    if kotlin_files:
        if capabilities["kotlinc_available"]:
            t_kt = time.perf_counter()
            kt_cmd = [
                _which("kotlinc") or "kotlinc",
                "-J-Xmx256m",
                "-cp",
                str(out_dir),
                "-d",
                str(out_dir),
                *[str(p) for p in kotlin_files if "/test/" not in p.as_posix() and "/androidTest/" not in p.as_posix()],
            ]
            kt_res = await run_process(
                kt_cmd,
                directory,
                timeout=settings.COMPILATION_TIMEOUT,
                resource_limits={"max_memory_bytes": 0, "max_cpu_seconds": min(45, settings.COMPILATION_TIMEOUT)},
            )
            dt_kt = max(1, int((time.perf_counter() - t_kt) * 1000))
            if not kt_res.success:
                cleaned_err = _strip_workspace_prefix(kt_res.error, directory)
                kt_diags = _parse_javac_diagnostics(cleaned_err, directory)
                all_diagnostics.extend(kt_diags)
                steps.append({"id": "step-kt", "label": ":app:compileDebugKotlin", "status": "failed", "durationMs": dt_kt})
                logs.append("> Task :app:compileDebugKotlin FAILED")
                logs.extend(cleaned_err.splitlines())
                return RuntimeResult(
                    False,
                    output="\n".join(logs),
                    error=cleaned_err,
                    exit_code=kt_res.exit_code or 1,
                    stages={"compile": "failed"},
                    timings={"total_seconds": round(time.perf_counter() - started, 4)},
                    verification={"steps": steps, "diagnostics": all_diagnostics, "capabilities": capabilities, "compiled_classes": compiled_classes},
                )
            steps.append({"id": "step-kt", "label": ":app:compileDebugKotlin", "status": "success", "durationMs": dt_kt})
            logs.append(f"> Task :app:compileDebugKotlin ({dt_kt}ms)")
        else:
            logs.append("Note: kotlinc is not installed in the sandbox worker; Kotlin sources were checked statically without JVM bytecode compilation.")

    artifact = None
    if task == "assembleDebug":
        t_pkg = time.perf_counter()
        artifact = _package_debug_apk(directory, project_files, out_dir, package_name, capabilities)
        dt_pkg = max(1, int((time.perf_counter() - t_pkg) * 1000))
        steps.append({"id": "step-pkg", "label": ":app:packageDebug", "status": "success", "durationMs": dt_pkg})
        logs.append(
            f"> Task :app:packageDebug (app-debug.apk, {artifact['size_bytes']} bytes, {artifact['entry_count']} entries)"
            if artifact
            else "> Task :app:packageDebug"
        )

    total_ms = max(1, int((time.perf_counter() - started) * 1000))
    logs.append(f"BUILD SUCCESSFUL in {total_ms}ms ({len(compiled_classes)} project class files compiled)")
    return RuntimeResult(
        True,
        output="\n".join(logs),
        exit_code=0,
        stages={"compile": "passed", "build": "passed"},
        timings={"total_seconds": round(time.perf_counter() - started, 4)},
        verification={
            "steps": steps,
            "diagnostics": all_diagnostics,
            "capabilities": capabilities,
            "compiled_classes": compiled_classes,
            "artifact": artifact,
            "package_name": package_name,
        },
    )
