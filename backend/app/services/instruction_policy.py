"""Parse and normalize user-supplied Additional instructions for prompts, evidence, and reports."""

from dataclasses import dataclass
import re


SUPPORTED_FONTS = (
    "Times New Roman",
    "Calibri",
    "Cambria",
    "Arial",
    "Verdana",
    "Georgia",
    "Consolas",
)


@dataclass(frozen=True)
class InstructionPreferences:
    raw: str
    output_only_screenshots: bool = False
    paste_under_question: bool = False
    no_extra_questions: bool = False
    no_conclusion: bool = False
    no_extra_manual_pages: bool = False
    font_name: str | None = None
    font_size: int | None = None


def clean_instructions(raw: str | None) -> str:
    text = str(raw or "").strip()
    text = re.sub(r"^\[screenshot_style:[^\]]+\]\s*", "", text, flags=re.I)
    return text.strip()


def parse_instruction_preferences(raw: str | None) -> InstructionPreferences:
    text = clean_instructions(raw)
    if not text:
        return InstructionPreferences(raw="")

    lower = text.lower()

    asks_both = bool(re.search(r"\b(?:both|code\s+and\s+output|source\s+and\s+output)\b", lower))
    output_only = not asks_both and bool(
        re.search(
            r"\b(?:only\s+(?:paste\s+|include\s+|attach\s+|show\s+)?(?:the\s+)?(?:output|execution|result)\s+screenshots?"
            r"|(?:output|execution|result)\s+screenshots?\s+only"
            r"|just\s+(?:the\s+)?(?:output|execution|result)\s+screenshots?"
            r"|(?:no|without|skip|omit|don'?t\s+(?:include|add|paste|show)|do\s+not\s+(?:include|add|paste|show))\s+(?:any\s+)?(?:source\s+)?(?:code|program)\s+(?:screenshots?|previews?|images?)"
            r"|(?:no|without|skip|omit)\s+source_preview)\b",
            lower,
        )
    )

    # "Place the generated screenshot immediately below its corresponding experiment output" (2026-11-20 audit wording) and
    # "paste screenshots under each question" both ask for in-manual placement; "do not place ... under unrelated experiments"
    # does not.
    placement = re.compile(
        r"\b(?:paste(?:d)?|put|place|insert|attach|add|include|show|screenshots?)\b.{0,60}?\b(?:under|below|beneath|after|next\s+to)\s+"
        r"(?:the\s+|that\s+|this\s+|each\s+|its\s+|their\s+|every\s+)?(?:own\s+|corresponding\s+|respective\s+|relevant\s+|matching\s+)?"
        r"(?:questions?|experiments?|programs?|practicals?|exercises?|outputs?|tasks?)\b"
    )
    paste_under = any(
        not re.search(r"\b(?:not|never|don'?t|avoid)\b[^.]{0,40}$", lower[: match.start()])
        for match in placement.finditer(lower)
    )

    no_extra_questions = bool(
        re.search(
            r"\b(?:no\s+need\s+to\s+(?:write|add|include|repeat|generate)|no|without|skip|omit|don'?t\s+(?:write|add|include|repeat|generate)|do\s+not\s+(?:write|add|include|repeat|generate))\s+(?:any\s+)?(?:extra|additional|duplicate|more|other|post[- ]?experiment(?:al)?|viva)\s+questions?\b",
            lower,
        )
    )

    explicit_conclusion = bool(re.search(r"\b(?:include|write|add)\s+(?:a\s+)?conclusion\b", lower))
    no_conclusion = not explicit_conclusion and bool(
        re.search(
            r"\b(?:no|without|skip|omit|don'?t\s+(?:write|add|include)|do\s+not\s+(?:write|add|include))\s+(?:a\s+|the\s+)?conclusion\b",
            lower,
        )
        or (no_extra_questions and output_only)
    )

    no_extra_manual_pages = bool(
        re.search(
            r"\b(?:no|without|skip|omit|don'?t\s+(?:copy|include|repeat|prepend|attach)|do\s+not\s+(?:copy|include|repeat|prepend|attach))\s+(?:the\s+)?(?:original\s+|uploaded\s+)?(?:manual|pdf\s+pages|pages)\b",
            lower,
        )
    )

    font_name = None
    for candidate in SUPPORTED_FONTS:
        if re.search(rf"\b{re.escape(candidate)}\b", text, re.I):
            font_name = candidate
            break

    font_size = None
    size_match = re.search(
        r"\bfont\s*(?:size)?\s*[:=]?\s*(\d{1,2})\s*(?:pt|pts|px)?\b|\b(\d{1,2})\s*pt\b",
        lower,
    )
    if size_match:
        val = int(size_match.group(1) or size_match.group(2))
        if 8 <= val <= 18:
            font_size = val

    return InstructionPreferences(
        raw=text,
        output_only_screenshots=output_only,
        paste_under_question=paste_under,
        no_extra_questions=no_extra_questions,
        no_conclusion=no_conclusion,
        no_extra_manual_pages=no_extra_manual_pages,
        font_name=font_name,
        font_size=font_size,
    )


def filter_output_only_candidates(candidates: list[dict]) -> list[dict]:
    """Keep only execution/output screenshots when non-source evidence exists."""
    non_source = [item for item in candidates if item.get("kind") != "source_preview"]
    return non_source if non_source else list(candidates)
