"""Populate official, hash-checked artifacts while building the trusted image.

Never executed by student code; the execution namespace remains offline.
"""
import hashlib
import json
import os
import sys
from pathlib import Path

root = Path('/opt/labmate-runtime/dl-cache')
os.environ.update(KERAS_HOME=str(root / 'keras'), CUDA_VISIBLE_DEVICES='',
                  TF_CPP_MIN_LOG_LEVEL='2', OMP_NUM_THREADS='1',
                  TF_NUM_INTRAOP_THREADS='1', TF_NUM_INTEROP_THREADS='1')
from tensorflow import keras

profiles = set(sys.argv[1:])
if profiles - {'mnist', 'mobilenet', 'resnet'}:
    raise ValueError('Unknown approved cache profile')
if 'mnist' in profiles:
    (x, y), (test_x, test_y) = keras.datasets.mnist.load_data()
    assert x.shape == (60000, 28, 28) and test_x.shape == (10000, 28, 28)
    assert y.shape == (60000,) and test_y.shape == (10000,)
if 'mobilenet' in profiles:
    keras.applications.MobileNetV2(include_top=False, weights='imagenet')
    keras.backend.clear_session()
if 'resnet' in profiles:
    keras.applications.ResNet50(include_top=False, weights='imagenet')
    keras.backend.clear_session()
# Keras verifies its official download checksums. Record the exact cached bytes
# as an additional integrity check when copying them into a fresh job directory.
manifest = {}
for path in (root / 'keras').rglob('*'):
    if path.is_file() and path.name != 'keras.json':
        manifest[path.relative_to(root / 'keras').as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
(root / 'manifest.json').write_text(json.dumps(manifest, sort_keys=True))
