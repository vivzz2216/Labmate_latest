import { createNewAndroidProject, type StudioProjectPreset } from "./androidStudioEngine";
import { dispatchRuntimeWidgetClick, launchAndroidRuntimeSession, updateRuntimeInputValue, type AndroidRuntimeSession } from "./androidActivityRuntime";

export interface AndroidPracticalFrame {
  id: string;
  title: string;
  explain: string;
  project: StudioProjectPreset;
  session: AndroidRuntimeSession;
  file: string;
}

const PACKAGE = "com.example.practical";
const LAYOUT = "app/src/main/res/layout/";
const JAVA = "app/src/main/java/com/example/practical/";

function edit(id: string, hint: string, numeric = false) {
  return `<EditText android:id="@+id/${id}" android:layout_width="match_parent" android:layout_height="wrap_content" android:hint="${hint}"${numeric ? ' android:inputType="numberSigned"' : ""} />`;
}
function button(id: string, text: string) {
  return `<Button android:id="@+id/${id}" android:layout_width="match_parent" android:layout_height="wrap_content" android:text="${text}" />`;
}
function layout(items: string[]) {
  return `<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:layout_width="match_parent" android:layout_height="match_parent"
  android:orientation="vertical" android:padding="16dp">
  ${items.join("\n  ")}
  <TextView android:id="@+id/result" android:layout_width="match_parent"
    android:layout_height="wrap_content" android:text="Ready" />
</LinearLayout>`;
}

function activity(name: string, resource: string, code: string) {
  return `package ${PACKAGE};

import android.os.Bundle;
import android.content.Intent;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;

public class ${name} extends AppCompatActivity {
    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        setContentView(R.layout.${resource});
        TextView result = findViewById(R.id.result);
        ${code}
    }
}`;
}

export function androidPractical(topic: string): AndroidPracticalFrame[] {
  const titles: Record<string, string> = { greeting: "Greeting", navigation: "Student Details", calculator: "Calculator",
    registration: "Student Registration", counter: "Persistent Counter" };
  const title = titles[topic];
  if (!title) throw new Error("Unknown Android practical.");
  const project = createNewAndroidProject({ appName: title, packageName: PACKAGE, template: "two-activity-java", minSdk: 24 });
  let widgets: string[];
  let code: string;
  switch (topic) {
    case "greeting":
    case "navigation":
      widgets = [edit("name", "Student name"), button("submit", topic === "greeting" ? "Show greeting" : "Open details")];
      code = `EditText name = findViewById(R.id.name);
        Button submit = findViewById(R.id.submit);
        submit.setOnClickListener(v -> {
            String entered = name.getText().toString().trim();
            ${topic === "greeting" ? 'result.setText("Hello, " + entered);' : 'Intent intent = new Intent(MainActivity.this, SecondActivity.class);\n            intent.putExtra("student", entered);\n            startActivity(intent);'}
        });`;
      break;
    case "calculator":
      widgets = [edit("left", "First number", true), edit("right", "Second number", true), button("add", "Add"), button("subtract", "Subtract")];
      code = `EditText left = findViewById(R.id.left);
        EditText right = findViewById(R.id.right);
        Button add = findViewById(R.id.add);
        Button subtract = findViewById(R.id.subtract);
        ${["add", "subtract"].map((op) => `${op}.setOnClickListener(v -> {
            String a = left.getText().toString().trim();
            String b = right.getText().toString().trim();
            if (a.isEmpty() || b.isEmpty()) {
                result.setText("Enter both numbers");
                return;
            }
            int x = Integer.parseInt(a);
            int y = Integer.parseInt(b);
            result.setText(String.valueOf(x ${op === "add" ? "+" : "-"} y));
        });`).join("\n        ")}`;
      break;
    case "registration":
      widgets = [edit("name", "Student name"), edit("email", "Email"), edit("course", "Course"), button("submit", "Register")];
      code = `EditText name = findViewById(R.id.name);
        EditText email = findViewById(R.id.email);
        EditText course = findViewById(R.id.course);
        Button submit = findViewById(R.id.submit);
        submit.setOnClickListener(v -> {
            String student = name.getText().toString().trim();
            String address = email.getText().toString().trim();
            String programme = course.getText().toString().trim();
            if (student.isEmpty() || address.isEmpty() || programme.isEmpty()) {
                result.setText("Complete all fields");
                return;
            }
            result.setText("Registered: " + student);
        });`;
      break;
    default:
      widgets = [button("increment", "Increment"), button("reset", "Reset")];
      code = `int count = getSharedPreferences("counter", MODE_PRIVATE).getInt("value", 0);
        result.setText(String.valueOf(count));
        Button increment = findViewById(R.id.increment);
        Button reset = findViewById(R.id.reset);
        increment.setOnClickListener(v -> {
            int saved = getSharedPreferences("counter", MODE_PRIVATE).getInt("value", 0);
            int next = saved + 1;
            getSharedPreferences("counter", MODE_PRIVATE).edit().putInt("value", next).apply();
            result.setText(String.valueOf(next));
        });
        reset.setOnClickListener(v -> {
            getSharedPreferences("counter", MODE_PRIVATE).edit().putInt("value", 0).apply();
            result.setText("0");
        });`;
  }
  const sources: Record<string, string> = {
    [JAVA + "MainActivity.java"]: activity("MainActivity", "activity_main", code),
    [LAYOUT + "activity_main.xml"]: layout(widgets),
    [JAVA + "SecondActivity.java"]: activity("SecondActivity", "activity_second", 'result.setText(getIntent().getStringExtra("student"));'),
    [LAYOUT + "activity_second.xml"]: layout([]),
  };
  project.files = project.files.map((file) => sources[file.path] ? { ...file, content: sources[file.path] } : file);
  const frames: AndroidPracticalFrame[] = [];
  let session = launchAndroidRuntimeSession(project.files, PACKAGE).session;
  function add(title: string, explain: string, file = "MainActivity.java") {
    if (session.crashError) throw new Error(session.crashError);
    frames.push({ id: "step" + (frames.length + 1), title, explain, project, session, file });
  }
  function input(id: string, value: string) {
    session = updateRuntimeInputValue(session, id, value);
  }
  function expectValue(value: string) {
    const frame = session.activityStack[session.activityStack.length - 1];
    if (session.crashError || frame?.widgetTextOverrides.result !== value) {
      throw new Error("Android output mismatch. Expected " + value + ", got " + frame?.widgetTextOverrides.result);
    }
  }
  function click(id: string, value: string) {
    session = dispatchRuntimeWidgetClick(session, project.files, id).session;
    expectValue(value);
  }
  add("Initial app layout", "The application opened in the LabMate interactive Android runtime.", "activity_main.xml");
  if (topic === "greeting" || topic === "navigation") {
    input("name", "Asha");
    click("submit", topic === "greeting" ? "Hello, Asha" : "Asha");
    add(topic === "greeting" ? "Personalised greeting" : "Name received by the second activity",
      topic === "greeting" ? "The button displayed Hello, Asha." : "The second activity displayed the name passed through the Intent.");
    if (topic === "navigation") add("Second activity source", "The second activity reads the student Intent extra.", "SecondActivity.java");
  } else if (topic === "calculator") {
    click("add", "Enter both numbers");
    add("Empty input validation", "The app prompted for both numbers.");
    input("left", "12"); input("right", "7");
    click("add", "19"); add("Addition result", "12 + 7 displayed 19.");
    click("subtract", "5"); add("Subtraction result", "12 − 7 displayed 5.");
  } else if (topic === "registration") {
    click("submit", "Complete all fields");
    add("Required field validation", "An empty form was rejected.");
    input("name", "Asha"); input("email", "asha@example.com"); input("course", "Computer Engineering");
    click("submit", "Registered: Asha"); add("Registration confirmation", "The completed form displayed Registered: Asha.");
  } else {
    click("increment", "1"); click("increment", "2");
    add("Counter before relaunch", "Two increments wrote 2 to SharedPreferences.");
    session = launchAndroidRuntimeSession(project.files, PACKAGE, session.integerPreferences).session;
    session = {
      ...session,
      toasts: [{ id: "relaunch-1", message: "Relaunched MainActivity: restored 2 from SharedPreferences", timestamp: session.lastLaunchTimeMs }],
    };
    expectValue("2"); add("Counter after relaunch", "A new activity instance read the saved value 2.");
    session = { ...session, toasts: [] };
    click("reset", "0"); add("Reset counter", "Reset saved 0 and updated the label.");
  }
  return frames;
}
