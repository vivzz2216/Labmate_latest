"""Bounded data-only previews; never execute constructors from uploaded files."""
import io
import json
import pickle
from pathlib import Path


class DataOnlyUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        raise pickle.UnpicklingError('Object constructors are prohibited in file previews.')

    def persistent_load(self, identifier):
        raise pickle.UnpicklingError('Persistent object references are prohibited in file previews.')


def _bounded_json(value):
    pending = [(value, 0)]
    nodes = characters = 0
    while pending:
        item, depth = pending.pop()
        nodes += 1
        if nodes > 1000 or depth > 20:
            raise ValueError('Binary preview structure exceeds its budget.')
        if isinstance(item, (dict, list, tuple)):
            if len(item) > 1000:
                raise ValueError('Binary preview collection exceeds its budget.')
            children = [part for pair in item.items() for part in pair] if isinstance(item, dict) else item
            pending.extend((child, depth + 1) for child in children)
        elif isinstance(item, str):
            characters += len(item)
            if characters > 16000:
                raise ValueError('Binary preview text exceeds its budget.')
        elif item is not None and not isinstance(item, (bool, int, float)):
            raise ValueError('Unsupported binary record type.')
    return json.dumps(value, indent=2, ensure_ascii=False)[:5000]


def file_preview(path):
    source = Path(path)
    if source.is_symlink() or not source.is_file():
        return '[File preview unavailable]'
    if source.suffix.lower() == '.pkl':
        if source.stat().st_size > 65536:
            return '[Binary preview omitted: file exceeds 64 KiB]'
        try:
            # Primitive student records remain readable; GLOBAL/REDUCE callables
            # cannot be resolved. No custom object or application class is loaded.
            with source.open('rb') as stream:
                content = stream.read(65537)
            if len(content) > 65536:
                return '[Binary preview omitted: file exceeds 64 KiB]'
            data = DataOnlyUnpickler(io.BytesIO(content)).load()
            return _bounded_json(data)
        except (ValueError, TypeError, RecursionError, EOFError, pickle.UnpicklingError, OverflowError):
            return '[Binary file: object deserialization is disabled]'
    with source.open(encoding='utf-8', errors='replace') as stream:
        return stream.read(5000)
