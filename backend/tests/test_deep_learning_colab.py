"""Tests for the CPU-based Deep-Learning Colab workflow."""
from pathlib import Path
from types import SimpleNamespace

import pytest
from docx import Document
from PIL import Image

from app.security.generated_code import validate_generated_code
from app.services.colab_requirements import missing_required_libraries
from app.services.colab_worker import validate_cell
from app.services.evidence_planner import experiment_category, plan_experiment
from app.services.lab_capture import capture_notebook
from app.services.manual_sections import numbered_experiments, section_language
from app.services.notebook_runtime import ColabPythonKernel


def test_deep_learning_manual_sections_and_planner_route_to_colab():
    manual = (
        "Experiment 1: Multilayer Perceptron using PyTorch\n"
        "Aim: Build and train a feed-forward neural network on CPU using PyTorch.\n\n"
        "Experiment 2: Image Classification with TensorFlow and Keras\n"
        "Aim: Train a small CNN using TensorFlow and Keras on MNIST and plot training loss.\n"
    )
    sections = numbered_experiments(manual)
    assert len(sections) == 2
    assert [s["language"] for s in sections] == ["colab", "colab"]

    pytorch_code = "import torch\nimport torch.nn as nn\nprint(torch.__version__)"
    tf_code = "import tensorflow as tf\nfrom tensorflow import keras\nprint(tf.__version__)"
    keras_code = "import keras\nfrom keras import layers\nprint(keras.__version__)"

    assert experiment_category("python", "Train a neural network.", pytorch_code) == "notebook"
    assert experiment_category("python", "Train a CNN model.", tf_code) == "notebook"
    assert experiment_category("python", "Build an autoencoder.", keras_code) == "notebook"
    assert section_language("Perceptron Lab", pytorch_code) == "colab"
    assert section_language("Image Classifier", tf_code) == "colab"

    # Generated-code validator must allow deep-learning imports when routed to notebook
    validate_generated_code(pytorch_code, "python", capability="notebook")
    validate_generated_code(tf_code, "python", capability="notebook")
    validate_generated_code(keras_code, "python", capability="notebook")


def test_validate_cell_supports_two_arg_super_and_blocks_gpu_or_unavailable_libs():
    # Standard PyTorch nn.Module pattern with both super().__init__() and super(Net, self).__init__()
    validate_cell(
        "import torch\nimport torch.nn as nn\n"
        "class Net(nn.Module):\n"
        "    def __init__(self):\n"
        "        super(Net, self).__init__()\n"
    )
    # Unavailable library must be rejected clearly
    with pytest.raises(PermissionError, match="unavailable in the restricted notebook runtime"):
        validate_cell("import cupy as cp\nprint(cp.__name__)")

    # Explicit GPU hardware requirements must fail with a clear CPU runtime diagnostic
    for gpu_snippet in (
        "import torch\nx = torch.ones(2, 2).cuda()",
        "import torch\nx = torch.ones(2, 2).to('cuda')",
        "import torch\nx = torch.ones(2, 2).to('cuda:0')",
        "import tensorflow as tf\nwith tf.device('/GPU:0'):\n    pass",
    ):
        with pytest.raises((PermissionError, RuntimeError), match="GPU execution is unavailable in the CPU lab runtime"):
            validate_cell(gpu_snippet)


@pytest.mark.asyncio
async def test_pytorch_neural_network_training_predictions_and_plot(tmp_path, monkeypatch):
    monkeypatch.setenv("LABMATE_SANDBOX_WORKER", "1")
    csv_data = "x1,x2,label\n0.1,0.2,0\n0.2,0.1,0\n0.15,0.25,0\n0.8,0.9,1\n0.9,0.85,1\n0.85,0.95,1\n"
    code = """import pandas as pd
import torch
import torch.nn as nn
import matplotlib.pyplot as plt

torch.manual_seed(42)
df = pd.read_csv('sensor_data.csv')
X = torch.tensor(df[['x1', 'x2']].values, dtype=torch.float32)
y = torch.tensor(df['label'].values, dtype=torch.float32).unsqueeze(1)

class SimpleClassifier(nn.Module):
    def __init__(self):
        super(SimpleClassifier, self).__init__()
        self.net = nn.Sequential(nn.Linear(2, 4), nn.ReLU(), nn.Linear(4, 1), nn.Sigmoid())
    def forward(self, x):
        return self.net(x)

model = SimpleClassifier()
criterion = nn.BCELoss()
optimizer = torch.optim.SGD(model.parameters(), lr=0.5)

losses = []
for epoch in range(25):
    optimizer.zero_grad()
    out = model(X)
    loss = criterion(out, y)
    loss.backward()
    optimizer.step()
    losses.append(float(loss.item()))

with torch.no_grad():
    preds = (model(X) >= 0.5).int().squeeze().tolist()

print('Framework: PyTorch', torch.__version__)
print('Initial loss > Final loss:', losses[0] > losses[-1])
print('Predictions:', preds)
plt.figure(figsize=(5, 3))
plt.plot(losses, label='Training Loss')
plt.title('PyTorch CPU Training Loss')
plt.legend()
plt.show()
"""
    result = await capture_notebook(
        code,
        datasets={"sensor_data.csv": csv_data},
        output_path=str(tmp_path / "pytorch_dl.png"),
        theme="dark",
        source_filename="pytorch_mlp.py",
    )
    assert result.success, result.error
    assert "Framework: PyTorch" in result.output
    assert "Initial loss > Final loss: True" in result.output
    assert "Predictions: [0, 0, 0, 1, 1, 1]" in result.output
    assert result.verification["status"] == "passed"
    assert result.verification.get("accelerator") == "CPU"
    assert result.verification["gpu"] is None
    cells = result.verification["cells"]
    assert len(cells[0]["plots"]) == 1
    assert any(d["name"] == "sensor_data.csv" and d["source"] == "provided" for d in cells[0]["datasets"])


@pytest.mark.asyncio
async def test_tensorflow_and_keras_offline_dataset_and_progress_hygiene(tmp_path, monkeypatch):
    monkeypatch.setenv("LABMATE_SANDBOX_WORKER", "1")
    code = """import tensorflow as tf
import keras
from keras import layers
import numpy as np

np.random.seed(7)
tf.random.set_seed(7)

from sklearn.datasets import load_digits
digits = load_digits()
x_train, y_train = digits.images[:64], digits.target[:64]
x_test, y_test = digits.images[100:116], digits.target[100:116]
x_train = x_train[:64].reshape(-1, 64).astype('float32') / 16.0
y_train = y_train[:64]
x_test = x_test[:16].reshape(-1, 64).astype('float32') / 16.0
y_test = y_test[:16]

model = keras.Sequential([
    layers.Input(shape=(64,)),
    layers.Dense(16, activation='relu'),
    layers.Dense(10, activation='softmax'),
])
model.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
history = model.fit(x_train, y_train, epochs=3, batch_size=16, verbose=1)
preds = np.argmax(model.predict(x_test[:4], verbose=0), axis=1).tolist()
print('TF version:', tf.__version__, 'Keras version:', keras.__version__)
print('Epochs trained:', len(history.history['loss']))
print('Sample predictions:', len(preds), preds)
"""
    result = await capture_notebook(
        code,
        output_path=str(tmp_path / "tf_keras_dl.png"),
        theme="light",
        source_filename="tf_keras_mnist.py",
    )
    assert result.success, result.error
    assert "TF version:" in result.output and "Keras version:" in result.output
    assert "Epochs trained: 3" in result.output
    assert "Sample predictions: 4" in result.output
    assert not any(d["source"] == "builtin_offline_sample" for d in result.verification["cells"][0]["datasets"])
    # Progress bar carriage returns must be normalized cleanly
    assert "\r" not in result.output


@pytest.mark.asyncio
async def test_keras_standalone_autoencoder_and_word_report(tmp_path, monkeypatch):
    monkeypatch.setenv("LABMATE_SANDBOX_WORKER", "1")
    code = """import keras
from keras import layers
import numpy as np

np.random.seed(11)
from sklearn.datasets import load_digits
digits = load_digits()
x_train, x_test = digits.images[:48], digits.images[100:108]
x_train = x_train[:48].reshape(-1, 64).astype('float32') / 16.0
x_test = x_test[:8].reshape(-1, 64).astype('float32') / 16.0

autoencoder = keras.Sequential([
    layers.Input(shape=(64,)),
    layers.Dense(16, activation='relu'),
    layers.Dense(64, activation='sigmoid'),
])
autoencoder.compile(optimizer='adam', loss='mse')
history = autoencoder.fit(x_train, x_train, epochs=3, batch_size=16, verbose=0)
recon = autoencoder.predict(x_test[:2], verbose=0)
mse = float(np.mean((x_test[:2] - recon) ** 2))
print('Keras autoencoder MSE:', round(mse, 4))
print('Reconstruction shape:', tuple(recon.shape))
"""
    result = await capture_notebook(
        code,
        output_path=str(tmp_path / "keras_ae.png"),
        theme="dark",
        source_filename="keras_autoencoder.py",
    )
    assert result.success, result.error
    assert "Keras autoencoder MSE:" in result.output
    assert "Reconstruction shape: (2, 64)" in result.output
    for frame in result.verification["evidence_frames"]:
        with Image.open(frame["path"]) as img:
            assert img.width == 1100
            assert 200 <= img.height <= 1450

    from app.services.assignment_workflow import build_word_report
    manual_docx = tmp_path / "keras_manual.docx"
    doc = Document()
    doc.add_heading("Deep Learning Lab Manual", 0)
    doc.add_paragraph("Experiment 3: Autoencoder using Keras")
    doc.save(str(manual_docx))

    upload = SimpleNamespace(
        file_path=str(manual_docx),
        file_type="docx",
        original_filename="keras_manual.docx",
    )
    workflow = SimpleNamespace(
        id=998,
        mode="code_only",
        instructions="",
        output_name="keras_lab_report",
        student_name="Riya Patel",
        roll_no="21CS088",
        department="Computer Science",
        institution="SFIT",
        results=[
            {
                "id": 1,
                "question": "Experiment 3: Build and train an Autoencoder using Keras.",
                "language": "colab",
                "answer": "Trained a dense autoencoder on CPU.",
                "code": code,
                "output": result.output,
                "error": "",
                "status": "completed",
                "screenshot_paths": list(result.screenshots.values()),
                "screenshot_captions": [f["caption"] for f in result.verification.get("evidence_frames", [])],
                "verification": result.verification,
                "verification_summary": {"status": "passed", "checks": {"execution": "passed"}, "failures": []},
            }
        ],
    )
    report_path, _ = build_word_report(upload, workflow)
    built = Document(report_path)
    full_text = "\n".join(p.text for p in built.paragraphs)
    assert "Deep Learning Lab Manual" in full_text
    assert "Experiment 3: Build and train an Autoencoder using Keras." in full_text
    assert len(built.inline_shapes) == len(result.screenshots)


@pytest.mark.asyncio
async def test_timeout_and_invalid_code_produce_diagnostic_report(tmp_path, monkeypatch):
    monkeypatch.setenv("LABMATE_SANDBOX_WORKER", "1")
    kernel = ColabPythonKernel(timeout_sec=2)
    try:
        timeout_res = kernel.execute_cell("import time\ntime.sleep(5)\nprint('done')", timeout_sec=1.2)
        assert timeout_res["execTime"] == "timeout"
        assert "exceeded its time limit" in (timeout_res["error"] or "")
    finally:
        kernel.cleanup()

    # Invalid GPU-only notebook must fail verification and produce a diagnostic Word report
    bad_result = await capture_notebook(
        "import torch\nx = torch.ones(4, 4).cuda()\nprint(x)",
        output_path=str(tmp_path / "failed_gpu.png"),
        theme="dark",
        source_filename="gpu_only.py",
    )
    assert not bad_result.success
    assert "GPU execution is unavailable in the CPU lab runtime" in bad_result.error
    assert bad_result.verification["status"] == "failed"

    # Build a Word report from an original manual + failed diagnostic + passed DL run
    from app.services.assignment_workflow import build_word_report
    manual_docx = tmp_path / "dl_manual.docx"
    doc = Document()
    doc.add_heading("Deep Learning Laboratory Manual", 0)
    doc.add_paragraph("Experiment 1: PyTorch CPU Neural Network")
    doc.save(str(manual_docx))

    upload = SimpleNamespace(
        file_path=str(manual_docx),
        file_type="docx",
        original_filename="dl_manual.docx",
    )
    workflow = SimpleNamespace(
        id=999,
        mode="code_only",
        instructions="",
        output_name="dl_lab_report",
        student_name="Aarav Sharma",
        roll_no="21CS042",
        department="Computer Science",
        institution="SFIT",
        results=[
            {
                "id": 1,
                "question": "Experiment 1: Train a neural network on GPU using CUDA.",
                "language": "colab",
                "answer": "Attempted GPU run.",
                "code": "import torch\nx = torch.ones(4, 4).cuda()",
                "output": "",
                "error": bad_result.error,
                "status": "failed",
                "screenshot_paths": list(bad_result.screenshots.values()),
                "screenshot_captions": [f["caption"] for f in bad_result.verification.get("evidence_frames", [])],
                "verification": bad_result.verification,
                "verification_summary": {"status": "failed", "checks": {"execution": "failed"}, "failures": [bad_result.error]},
            }
        ],
    )
    report_path, _ = build_word_report(upload, workflow)
    built = Document(report_path)
    full_text = "\n".join(p.text for p in built.paragraphs)
    assert "Diagnostic report" in full_text
    assert "GPU execution is unavailable in the CPU lab runtime" in full_text

