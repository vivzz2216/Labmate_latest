#!/usr/bin/env python3
"""
Automated Execution, Verification, Screenshot, Print-PDF & Word (.docx) Runner for Google Colab
Tests:
  1. Option 2: Supplied CSV data + DSLab Exp6 code with explicit modern-pandas numeric imputation
  2. Anti-AI Student Personalization: Respective student avatar initial (R, P, A, S...) + natural
     headline (DSLab_Rahul_Exp6.ipynb, MLLab_Aarav_Exp1.ipynb, etc.) + zero AI-tell banners
  3. Multi-Student Concurrent Task Queue (ColabExecutionQueue) across 6 University ML Experiments
"""

import json
import os
import sys
import tempfile
import time
from typing import Any, Dict, List

from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

from colab_pipeline import (
    ColabExecutionQueue,
    ColabPythonKernel,
    ensure_home_loan_dataset,
    render_and_capture_colab,
)

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(CURRENT_DIR, "screenshots")

# Option 2 Sample: Teacher-supplied CSV dataset text (as if pasted/uploaded by student)
with tempfile.TemporaryDirectory() as _tmp:
    _csv_file = ensure_home_loan_dataset(_tmp)
    with open(_csv_file, "r", encoding="utf-8") as _f:
        TEACHER_PASTED_HOME_LOAN_CSV = _f.read()


UNIVERSITY_ML_QUESTIONS: List[Dict[str, Any]] = [
    {
        "id": "Q01",
        "student_name": "Rahul Sharma",
        "subject": "DSLab",
        "exp_no": "6",
        "title": "DSLab Exp 6 Part A - Home Loan Classification (Gaussian Naive Bayes)",
        "aim": "Implement Home Loan classification using Gaussian Naive Bayes with explicit numeric-only imputation for modern pandas.",
        "datasets": {"home_loan_train.csv": TEACHER_PASTED_HOME_LOAN_CSV},
        "code": """import sklearn
import pandas as pd
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import GaussianNB

loan_data = pd.read_csv('home_loan_train.csv')
loan_data['Gender'] = LabelEncoder().fit_transform(loan_data['Gender'].astype(str))
loan_data['Married'] = LabelEncoder().fit_transform(loan_data['Married'].astype(str))
loan_data['Education'] = LabelEncoder().fit_transform(loan_data['Education'].astype(str))
loan_data['Self_Employed'] = LabelEncoder().fit_transform(loan_data['Self_Employed'].astype(str))
loan_data['Property_Area'] = LabelEncoder().fit_transform(loan_data['Property_Area'].astype(str))

loan_data = loan_data.drop('Loan_ID', axis=1)
loan_data = loan_data.fillna(loan_data.mean(numeric_only=True))

X = loan_data.drop('Loan_Status', axis=1)
Y = loan_data['Loan_Status']
Y = LabelEncoder().fit_transform(loan_data['Loan_Status'].astype(str))

X_train, X_test, y_train, y_test = train_test_split(X, Y, test_size=0.3, random_state=1)

Naivebayes = GaussianNB()
b = Naivebayes.fit(X_train, y_train)
c = Naivebayes.predict(X_test)
print(c)
acc = sklearn.metrics.accuracy_score(y_test, c)
print(acc)""",
        "expect_plot": False,
        "expect_substrings": ["[1 1 0", "1.0"],
    },
    {
        "id": "Q02",
        "student_name": "Priya Nair",
        "subject": "DSLab",
        "exp_no": "6",
        "title": "DSLab Exp 6 Part B - Compare Naive Bayes, SVM & KNN on Home Loan Dataset",
        "aim": "Compare the Home Loan dataset across Gaussian Naive Bayes, Support Vector Machine (SVM), and K-Nearest Neighbors (KNN) classifiers.",
        "datasets": {"home_loan_train.csv": TEACHER_PASTED_HOME_LOAN_CSV},
        "code": """import pandas as pd
import matplotlib.pyplot as plt
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import GaussianNB
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import accuracy_score, f1_score

df = pd.read_csv('home_loan_train.csv').drop('Loan_ID', axis=1)
for col in ['Gender', 'Married', 'Education', 'Self_Employed', 'Property_Area', 'Loan_Status']:
    df[col] = LabelEncoder().fit_transform(df[col].astype(str))
df = df.fillna(df.mean())

X = StandardScaler().fit_transform(df.drop('Loan_Status', axis=1))
y = df['Loan_Status']
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=1)

models = {
    'Naive Bayes': GaussianNB(),
    'SVM (RBF)': SVC(kernel='rbf', C=1.0, random_state=1),
    'KNN (k=5)': KNeighborsClassifier(n_neighbors=5)
}

results = {}
for name, clf in models.items():
    preds = clf.fit(X_train, y_train).predict(X_test)
    acc = accuracy_score(y_test, preds)
    f1 = f1_score(y_test, preds)
    results[name] = acc
    print(f"{name:14s} -> Accuracy: {acc:.4f} | F1-Score: {f1:.4f}")

plt.figure(figsize=(6.2, 2.8))
bars = plt.bar(list(results.keys()), list(results.values()), color=['#8ab4f8', '#81c995', '#fdd663'], width=0.48)
plt.ylim(0, 1.08)
plt.ylabel('Accuracy Score')
plt.title('Naive Bayes vs SVM vs KNN Accuracy')
for bar, val in zip(bars, results.values()):
    plt.text(bar.get_x() + bar.get_width()/2, val + 0.02, f"{val:.2%}", ha='center', fontsize=9.5)
plt.grid(axis='y')
plt.show()""",
        "expect_plot": True,
        "expect_substrings": ["Naive Bayes", "SVM (RBF)", "KNN (k=5)"],
    },
    {
        "id": "Q03",
        "student_name": "Aarav Patel",
        "subject": "MLLab",
        "exp_no": "1",
        "title": "Linear Regression - Study Hours vs Exam Score Prediction",
        "aim": "To implement Simple Linear Regression using scikit-learn, compute R2 Score & Mean Squared Error, and plot the fitted regression line.",
        "datasets": {},
        "code": """import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score

np.random.seed(42)
hours = np.linspace(1.5, 9.5, 50).reshape(-1, 1)
scores = 24.5 + 7.2 * hours.flatten() + np.random.normal(0, 3.2, size=50)

X_train, X_test, y_train, y_test = train_test_split(hours, scores, test_size=0.25, random_state=42)
reg = LinearRegression()
reg.fit(X_train, y_train)
y_pred = reg.predict(X_test)

print(f"Slope (Coefficient): {reg.coef_[0]:.4f}")
print(f"Intercept          : {reg.intercept_:.4f}")
print(f"Mean Squared Error : {mean_squared_error(y_test, y_pred):.4f}")
print(f"R2 Score           : {r2_score(y_test, y_pred):.4f}")

plt.figure(figsize=(6.2, 2.8))
plt.scatter(X_train, y_train, color='#8ab4f8', label='Training Data', alpha=0.85)
plt.scatter(X_test, y_test, color='#fdd663', label='Test Data', zorder=3)
plt.plot(hours, reg.predict(hours), color='#f28b82', linewidth=2, label='Fitted Line')
plt.xlabel('Study Hours / Day')
plt.ylabel('Exam Score (%)')
plt.title('Linear Regression: Study Hours vs Exam Score')
plt.legend()
plt.grid(True)
plt.show()""",
        "expect_plot": True,
        "expect_substrings": ["Slope (Coefficient):", "Intercept", "R2 Score"],
    },
    {
        "id": "Q04",
        "student_name": "Sneha Joshi",
        "subject": "MLLab",
        "exp_no": "2",
        "title": "Logistic Regression & Confusion Matrix Evaluation",
        "aim": "To build a Binary Logistic Regression classifier and evaluate Precision, Recall, F1-Score, and Confusion Matrix.",
        "datasets": {},
        "code": """import numpy as np
import matplotlib.pyplot as plt
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

X, y = make_classification(n_samples=300, n_features=6, n_informative=4, random_state=7)
X = StandardScaler().fit_transform(X)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=7)

log_reg = LogisticRegression()
log_reg.fit(X_train, y_train)
y_pred = log_reg.predict(X_test)
cm = confusion_matrix(y_test, y_pred)

print(f"Logistic Regression Accuracy : {accuracy_score(y_test, y_pred):.4f}")
print(f"Precision Score              : {precision_score(y_test, y_pred):.4f}")
print(f"Recall Score                 : {recall_score(y_test, y_pred):.4f}")
print(f"F1-Score                     : {f1_score(y_test, y_pred):.4f}")
print("Confusion Matrix:\\n", cm)

fig, ax = plt.subplots(figsize=(4.4, 2.7))
im = ax.imshow(cm, cmap='Blues')
for i in range(2):
    for j in range(2):
        ax.text(j, i, str(cm[i, j]), ha='center', va='center', color='#ffffff' if cm[i, j] > 20 else '#111111', fontweight='bold')
ax.set_xticks([0, 1]); ax.set_yticks([0, 1])
ax.set_xticklabels(['Pred 0', 'Pred 1']); ax.set_yticklabels(['Actual 0', 'Actual 1'])
ax.set_title('Confusion Matrix (Logistic Regression)')
plt.show()""",
        "expect_plot": True,
        "expect_substrings": ["Logistic Regression Accuracy", "Precision Score", "Confusion Matrix:"],
    },
    {
        "id": "Q05",
        "student_name": "Rohan Mehta",
        "subject": "DSLab",
        "exp_no": "7",
        "title": "Decision Tree & Random Forest Classifier with Feature Importance",
        "aim": "To implement Decision Tree and Random Forest classifiers on the Home Loan Dataset and visualize feature importance scores.",
        "datasets": {"home_loan_train.csv": TEACHER_PASTED_HOME_LOAN_CSV},
        "code": """import pandas as pd
import matplotlib.pyplot as plt
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

df = pd.read_csv('home_loan_train.csv').drop('Loan_ID', axis=1)
for c in ['Gender', 'Married', 'Education', 'Self_Employed', 'Property_Area', 'Loan_Status']:
    df[c] = LabelEncoder().fit_transform(df[c].astype(str))
df = df.fillna(df.mean())

X = df.drop('Loan_Status', axis=1)
y = df['Loan_Status']
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

dt = DecisionTreeClassifier(max_depth=4, random_state=42).fit(X_train, y_train)
rf = RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42).fit(X_train, y_train)

print(f"Decision Tree Accuracy (depth=4) : {accuracy_score(y_test, dt.predict(X_test)):.4f}")
print(f"Random Forest Accuracy (100 trees): {accuracy_score(y_test, rf.predict(X_test)):.4f}")

imp = pd.Series(rf.feature_importances_, index=X.columns).sort_values(ascending=True).tail(6)
plt.figure(figsize=(6.2, 2.7))
plt.barh(imp.index, imp.values, color='#81c995')
plt.xlabel('Gini Feature Importance')
plt.title('Top 6 Features - Random Forest Home Loan Model')
plt.grid(axis='x')
plt.show()""",
        "expect_plot": True,
        "expect_substrings": ["Decision Tree Accuracy", "Random Forest Accuracy"],
    },
    {
        "id": "Q06",
        "student_name": "Ananya Verma",
        "subject": "MLLab",
        "exp_no": "4",
        "title": "K-Means Clustering & Silhouette Evaluation",
        "aim": "To implement Unsupervised K-Means Clustering (K=3), compute cluster centroids, inertia, and Silhouette Score, and plot the discovered clusters.",
        "datasets": {},
        "code": """import numpy as np
import matplotlib.pyplot as plt
from sklearn.datasets import make_blobs
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

X, _ = make_blobs(n_samples=240, centers=3, cluster_std=1.05, random_state=42)
kmeans = KMeans(n_clusters=3, n_init=10, random_state=42)
labels = kmeans.fit_predict(X)
centroids = kmeans.cluster_centers_

print(f"K-Means Inertia (WCSS) : {kmeans.inertia_:.2f}")
print(f"Silhouette Score (K=3) : {silhouette_score(X, labels):.4f}")
print("Cluster Centroids:\\n", np.round(centroids, 3))

plt.figure(figsize=(6.0, 2.8))
colors = ['#8ab4f8', '#81c995', '#fdd663']
for k in range(3):
    pts = X[labels == k]
    plt.scatter(pts[:, 0], pts[:, 1], s=26, color=colors[k], label=f'Cluster {k+1}')
plt.scatter(centroids[:, 0], centroids[:, 1], s=130, color='#f28b82', marker='X', edgecolor='white', label='Centroids')
plt.title('K-Means Clustering (K=3) with Centroids')
plt.xlabel('Feature 1'); plt.ylabel('Feature 2')
plt.legend()
plt.grid(True)
plt.show()""",
        "expect_plot": True,
        "expect_substrings": ["K-Means Inertia", "Silhouette Score", "Cluster Centroids:"],
    },
]


def build_word_report(results: List[Dict[str, Any]], docx_path: str):
    """Generate a formatted University Word (.docx) Lab Report with code, output, and Colab screenshots."""
    doc = Document()

    title_p = doc.add_paragraph()
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_inst = title_p.add_run("St. Francis Institute of Technology\nDepartment of Information Technology\n")
    r_inst.bold = True
    r_inst.font.size = Pt(14)

    r_sub = title_p.add_run("Subject: Data Science & Machine Learning Lab\n")
    r_sub.bold = True
    r_sub.font.size = Pt(12)
    r_sub.font.color.rgb = RGBColor(0, 74, 119)

    for item in results:
        doc.add_heading(f"{item['id']}: {item['title']} ({item['student_name']})", level=2)
        p_aim = doc.add_paragraph()
        r_aim_lbl = p_aim.add_run("Aim: ")
        r_aim_lbl.bold = True
        p_aim.add_run(item["aim"])

        p_code_lbl = doc.add_paragraph()
        r_c = p_code_lbl.add_run("Python Source Code:")
        r_c.bold = True
        code_para = doc.add_paragraph(item["code"])
        code_para.style = "No Spacing"
        for run in code_para.runs:
            run.font.name = "Consolas"
            run.font.size = Pt(9)

        p_out_lbl = doc.add_paragraph()
        r_o = p_out_lbl.add_run("Console Output:")
        r_o.bold = True
        out_para = doc.add_paragraph(item["stdout"])
        out_para.style = "No Spacing"
        for run in out_para.runs:
            run.font.name = "Consolas"
            run.font.size = Pt(9)

        if os.path.exists(item["screenshot_path"]):
            p_img_lbl = doc.add_paragraph()
            r_i = p_img_lbl.add_run("Google Colab Execution Screenshot (Code + Output):")
            r_i.bold = True
            doc.add_picture(item["screenshot_path"], width=Inches(6.2))

        doc.add_page_break()

    doc.save(docx_path)


def run_colab_ml_pipeline() -> bool:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    queue = ColabExecutionQueue(max_workers=3, timeout_sec=45)

    print("========================================================================")
    print(" LABMATE GOOGLE COLAB MULTI-STUDENT ISOLATED QUEUE & ML PIPELINE")
    print(f" Output Directory: {OUTPUT_DIR}")
    print("========================================================================\n")

    # Prepare jobs for the Multi-Student Execution Queue
    jobs = []
    for q in UNIVERSITY_ML_QUESTIONS:
        first_name = q["student_name"].split()[0]
        shot_name = f"{q['id']}_{q['subject']}_{first_name}_Exp{q['exp_no']}.png"
        shot_path = os.path.join(OUTPUT_DIR, shot_name)
        jobs.append({
            "id": q["id"],
            "student_name": q["student_name"],
            "subject": q["subject"],
            "exp_no": q["exp_no"],
            "datasets": q["datasets"],
            "code_blocks": [q["code"]],  # Clean student code cell only (zero AI banners)
            "screenshot_path": shot_path,
            "meta": q,
        })

    # Execute concurrently through the bounded worker pool
    batch_results = queue.run_batch_concurrent(jobs)

    summary_records = []
    combined_notebook_cells = []

    for idx, (job, res) in enumerate(zip(jobs, batch_results), start=1):
        q = job["meta"]
        qid = q["id"]
        cell_res = res["cells"][0] if res.get("cells") else {}
        cell_res["execCount"] = idx

        passed = bool(res.get("success"))
        reasons = []
        if cell_res.get("error"):
            passed = False
            reasons.append(f"Runtime exception: {cell_res['error']}")

        stdout_text = cell_res.get("stdout") or ""
        for expected_str in q.get("expect_substrings", []):
            if expected_str not in stdout_text:
                passed = False
                reasons.append(f"Missing expected output substring: '{expected_str}'")

        if q.get("expect_plot") and not cell_res.get("plots"):
            passed = False
            reasons.append("Expected Matplotlib plot image but none was captured.")

        combined_notebook_cells.append(cell_res)

        status = "PASS" if passed else "FAIL"
        print(f"--- [{qid}] Student: {q['student_name']} (Avatar: '{res.get('avatar_initial')}') | File: {res.get('notebook_title')} ---")
        print(f"Status    : {status}")
        print(f"Stdout    :\n{stdout_text}")
        print(f"Plots     : {len(cell_res.get('plots', []))} captured")
        print(f"Screenshot: {res.get('screenshot_path')}\n")

        summary_records.append({
            "id": qid,
            "student_name": q["student_name"],
            "avatar_initial": res.get("avatar_initial"),
            "notebook_title": res.get("notebook_title"),
            "title": q["title"],
            "aim": q["aim"],
            "status": status,
            "errors": reasons,
            "code": q["code"],
            "stdout": stdout_text,
            "plots_count": len(cell_res.get("plots", [])),
            "screenshot": os.path.basename(res["screenshot_path"]),
            "screenshot_path": res["screenshot_path"],
        })

    # Generate Full Multi-Cell Notebook Screenshot + Ctrl+P Print PDF + Word (.docx) Report
    full_png_path = os.path.join(OUTPUT_DIR, "DSLab_Rahul_Exp6_Full_Notebook.png")
    full_pdf_path = os.path.join(OUTPUT_DIR, "DSLab_Rahul_Exp6_Colab_Print.pdf")
    full_docx_path = os.path.join(OUTPUT_DIR, "DSLab_Exp6_Lab_Report.docx")

    print("--- Generating Full Multi-Cell Colab Screenshot & Ctrl+P Print PDF ---")
    render_and_capture_colab(
        cells=combined_notebook_cells,
        screenshot_path=full_png_path,
        student_name="Rahul Sharma",
        subject="DSLab",
        exp_no="6",
        pdf_path=full_pdf_path,
        expand_full=True,
        unfocus_cells=True,
        viewport_width=1600,
        viewport_height=900,
    )
    print(f"Full Notebook PNG: {full_png_path}")
    print(f"Ctrl+P Print PDF : {full_pdf_path}")

    print("--- Generating University Word (.docx) Lab Report ---")
    build_word_report(summary_records, full_docx_path)
    print(f"Word Lab Report  : {full_docx_path}\n")

    report_json_path = os.path.join(OUTPUT_DIR, "colab_ml_automation_report.json")
    all_passed = all(r["status"] == "PASS" for r in summary_records)
    with open(report_json_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "total_questions": len(summary_records),
                "passed_questions": sum(1 for r in summary_records if r["status"] == "PASS"),
                "all_passed": all_passed,
                "full_notebook_screenshot": full_png_path,
                "printable_pdf": full_pdf_path,
                "word_report_docx": full_docx_path,
                "results": [
                    {k: v for k, v in r.items() if k != "code"} for r in summary_records
                ],
            },
            f,
            indent=2,
        )

    print("========================================================================")
    print(f" SUMMARY: {sum(1 for r in summary_records if r['status'] == 'PASS')}/{len(summary_records)} CONCURRENT STUDENT ML EXPERIMENTS PASSED")
    print("========================================================================")
    return all_passed


if __name__ == "__main__":
    ok = run_colab_ml_pipeline()
    sys.exit(0 if ok else 1)
