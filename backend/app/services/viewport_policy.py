"""Only explicitly requested mobile/responsive work needs mobile evidence."""
import re


def responsive_requested(text):
    return bool(re.search(
        r'\bresponsive\b|\bmedia quer(?:y|ies)\b|\bbreakpoints?\b|\bsmall(?:er)? screens?\b'
        r'|\bmobile[ -](?:friendly|first|layout|viewport|screen|device|version|view|app)\b'
        r'|\b(?:desktop\s+(?:and|&)\s+mobile|mobile\s+(?:and|&)\s+desktop)\b'
        r'|\b(?:on|for) mobile\b', text or '', re.I))
