"""Shared admission rule for uploaded manuals, independent of billing exemptions."""
import re

MAX_MANUAL_EXERCISES = 15


class ManualLimitError(ValueError):
    pass


def exercise_count(questions):
    """Count extracted tasks and explicitly numbered independent sub-exercises.

    Setup instructions and individual SQL/shell commands are execution steps,
    not additional exercises. A grouped experiment must not hide 16 programs.
    """
    total = 0
    for question in questions or []:
        text = str(question.get('text') or '')
        children = re.findall(
            r'^\s*(?:(?:question|exercise|program|q)\s*)?(?:\d+|[a-z])[.):]\s+(?:(?:write|develop|implement|build|design)\s+'
            r'(?:(?:a|an|the)\s+)?(?:(?:python|java|c\+\+|c|shell|perl|sql)\s+)?'
            r'(?:program|script|application|algorithm|function|class|query)\b|'
            r'(?:what|why|explain|define|discuss|differentiate)\b|'
            r'to\s+(?:display|order|list|find|print|calculate|convert)\b)', text, re.I | re.M)
        total += max(1, len(children))
    return total


def validate_manual(questions):
    count = exercise_count(questions)
    if count > MAX_MANUAL_EXERCISES:
        raise ManualLimitError(
            f'This manual contains {count} questions or exercises. The maximum is '
            f'{MAX_MANUAL_EXERCISES} per manual. Split it into smaller manuals and upload again.')
    return count
