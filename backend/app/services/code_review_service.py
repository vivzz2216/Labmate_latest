from __future__ import annotations

import ast
import json
import re
import textwrap
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from ..config import settings
from ..models import User
from .claude_client import ClaudeClient
from .profile_service import UserProfileService, UserProfileData


@dataclass
class ReviewIssue:
    title: str
    severity: str
    detail: str
    suggestion: str

    def as_dict(self) -> Dict[str, str]:
        return {
            "title": self.title,
            "severity": self.severity,
            "detail": self.detail,
            "suggestion": self.suggestion,
        }


@dataclass
class ReviewPackage:
    summary: str
    issues: List[ReviewIssue]
    improved_code: str
    source: str
    variant_label: Optional[str] = None


class CodeSafetyValidator:
    """Detects disallowed operations (file-system, network, etc.) in student code."""

    BANNED_CALLS = {
        "open",
        "os.remove",
        "os.unlink",
        "os.rmdir",
        "os.system",
        "subprocess.run",
        "subprocess.Popen",
        "pathlib.Path.open",
        "shutil.rmtree",
    }
    BANNED_IMPORTS = {"os", "subprocess", "pathlib", "shutil"}

    def inspect(self, code: str) -> List[ReviewIssue]:
        notices: List[ReviewIssue] = []
        try:
            tree = ast.parse(code)
        except SyntaxError as exc:
            notices.append(
                ReviewIssue(
                    title="Syntax error",
                    severity="critical",
                    detail=f"Syntax error on line {exc.lineno}: {exc.msg}",
                    suggestion="Fix the syntax error before submitting.",
                )
            )
            return notices

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name.split(".")[0] in self.BANNED_IMPORTS:
                        notices.append(
                            ReviewIssue(
                                title="Restricted import",
                                severity="high",
                                detail=f"Importing '{alias.name}' is not allowed for lab submissions.",
                                suggestion="Remove the import and avoid filesystem or OS access.",
                            )
                        )
            elif isinstance(node, ast.ImportFrom):
                if node.module and node.module.split(".")[0] in self.BANNED_IMPORTS:
                    notices.append(
                        ReviewIssue(
                            title="Restricted import",
                            severity="high",
                            detail=f"Importing from '{node.module}' is not allowed.",
                            suggestion="Remove the import and keep the solution pure Python.",
                        )
                    )
            elif isinstance(node, ast.Call):
                call_name = self._get_call_name(node.func)
                if call_name in self.BANNED_CALLS:
                    notices.append(
                        ReviewIssue(
                            title="Disallowed operation",
                            severity="high",
                            detail=f"Detected call to '{call_name}', which counts as a file/system operation.",
                            suggestion="Use in-memory data structures only (lists, dicts, etc.).",
                        )
                    )
        return notices

    @staticmethod
    def _get_call_name(func: ast.AST) -> str:
        if isinstance(func, ast.Name):
            return func.id
        if isinstance(func, ast.Attribute):
            value = CodeSafetyValidator._get_call_name(func.value)
            return f"{value}.{func.attr}" if value else func.attr
        return ""


class PersonalizedCodeFormatter:
    """Injects real user profile data into placeholder strings."""

    NAME_PATTERNS = [
        re.compile(r'(name\s*=\s*)(["\']).*?\2', flags=re.IGNORECASE),
        re.compile(r'(student_name\s*=\s*)(["\']).*?\2', flags=re.IGNORECASE),
    ]
    AGE_PATTERNS = [
        re.compile(r'(age\s*=\s*)(\d+)', flags=re.IGNORECASE),
    ]
    CITY_PATTERNS = [
        re.compile(r'(city\s*=\s*)(["\']).*?\2', flags=re.IGNORECASE),
        re.compile(r'(location\s*=\s*)(["\']).*?\2', flags=re.IGNORECASE),
    ]
    COURSE_PATTERNS = [
        re.compile(r'(course\s*=\s*)(["\']).*?\2', flags=re.IGNORECASE),
        re.compile(r'(branch\s*=\s*)(["\']).*?\2', flags=re.IGNORECASE),
    ]

    def apply(self, code: str, profile: UserProfileData) -> str:
        personalized = code

        if profile.name:
            for pattern in self.NAME_PATTERNS:
                personalized = pattern.sub(rf'\1"{profile.name}"', personalized)
        if profile.age:
            for pattern in self.AGE_PATTERNS:
                personalized = pattern.sub(rf"\1{profile.age}", personalized)
        if profile.city:
            for pattern in self.CITY_PATTERNS:
                personalized = pattern.sub(rf'\1"{profile.city}"', personalized)
        if profile.course:
            for pattern in self.COURSE_PATTERNS:
                personalized = pattern.sub(rf'\1"{profile.course}"', personalized)

        header = textwrap.dedent(
            f'''
            """Assignment personalized for {profile.name} ({profile.age or "N/A"} yrs, {profile.course or "Course"} @ {profile.institution or "Institution"}, {profile.city or "City"})."""
            '''
        ).strip()

        if not personalized.lstrip().startswith('"""Assignment personalized'):
            personalized = f"{header}\n\n{personalized}"

        return personalized


class StackTemplateBuilder:
    """Produces deterministic stack implementations using Python lists only."""

    @staticmethod
    def build_base_template(problem_statement: Optional[str] = None) -> str:
        summary = problem_statement or "Implement a stack using an array."
        return textwrap.dedent(
            f"""
            \"\"\"Auto-improved solution: {summary.strip()}\"\"\"
            from dataclasses import dataclass, field
            from typing import Generic, List, Optional, TypeVar


            T = TypeVar("T")


            class StackOverflowError(Exception):
                pass


            class StackUnderflowError(Exception):
                pass


            @dataclass
            class ArrayStack(Generic[T]):
                capacity: int
                student_name: str = "Student Name"
                age: int = 20
                city: str = "Your City"
                course: str = "Your Course"
                _data: List[Optional[T]] = field(init=False)
                _top: int = field(default=-1, init=False)

                def __post_init__(self) -> None:
                    if self.capacity <= 0:
                        raise ValueError("Capacity must be positive.")
                    self._data = [None] * self.capacity

                def push(self, value: T) -> None:
                    if self.is_full():
                        raise StackOverflowError("Stack overflow")
                    self._top += 1
                    self._data[self._top] = value

                def pop(self) -> T:
                    if self.is_empty():
                        raise StackUnderflowError("Stack underflow")
                    value = self._data[self._top]
                    self._data[self._top] = None
                    self._top -= 1
                    return value  # type: ignore[return-value]

                def peek(self) -> T:
                    if self.is_empty():
                        raise StackUnderflowError("Cannot peek an empty stack")
                    return self._data[self._top]  # type: ignore[return-value]

                def is_empty(self) -> bool:
                    return self._top == -1

                def is_full(self) -> bool:
                    return self._top == self.capacity - 1

                def size(self) -> int:
                    return self._top + 1

                def to_list(self) -> List[T]:
                    return [item for item in self._data[: self._top + 1] if item is not None]

                def describe_owner(self) -> str:
                    return (
                        f"Stack prepared by {{self.student_name}} "
                        f"({{self.age}} yrs, {{self.course}} - {{self.city}})."
                    )


            def demonstrate_stack(values: List[T], capacity: int) -> ArrayStack[T]:
                stack = ArrayStack[T](capacity=capacity)
                for item in values:
                    stack.push(item)
                return stack


            if __name__ == "__main__":
                sample_values = [10, 20, 30, 40]
                demo_stack = demonstrate_stack(sample_values, capacity=10)
                print(demo_stack.describe_owner())
                print("Stack contents:", demo_stack.to_list())
                print("Top element:", demo_stack.peek())
            """
        ).strip()

    @staticmethod
    def build_variant_template(problem_statement: Optional[str] = None) -> str:
        summary = problem_statement or "Implement a stack using an array."
        return textwrap.dedent(
            f"""
            \"\"\"Alternate approach: {summary.strip()}\"\"\"
            from typing import Generic, List, TypeVar

            T = TypeVar("T")


            class ArrayStack(Generic[T]):
                def __init__(self, capacity: int, *, owner: str = "Student Name", age: int = 19, city: str = "Your City") -> None:
                    if capacity <= 0:
                        raise ValueError("Capacity must be > 0")
                    self._capacity = capacity
                    self._items: List[T] = [None] * capacity  # type: ignore[list-item]
                    self._top = -1
                    self.owner = owner
                    self.age = age
                    self.city = city

                def push(self, value: T) -> None:
                    if self._top + 1 >= self._capacity:
                        raise OverflowError("Cannot push: stack is full")
                    self._top += 1
                    self._items[self._top] = value

                def pop(self) -> T:
                    if self._top == -1:
                        raise IndexError("Cannot pop: stack is empty")
                    value = self._items[self._top]
                    self._items[self._top] = None  # type: ignore[list-item]
                    self._top -= 1
                    return value  # type: ignore[return-value]

                def peek(self) -> T:
                    if self._top == -1:
                        raise IndexError("Cannot peek: stack is empty")
                    return self._items[self._top]  # type: ignore[return-value]

                def remaining_capacity(self) -> int:
                    return self._capacity - (self._top + 1)

                def snapshot(self) -> List[T]:
                    return [item for item in self._items[: self._top + 1] if item is not None]

                def __repr__(self) -> str:
                    return f"ArrayStack(owner={{self.owner}}, city={{self.city}}, size={{self._top + 1}})"


            def solve(operations: List[T]) -> ArrayStack[T]:
                stack = ArrayStack[T](capacity=max(len(operations), 1))
                for value in operations:
                    stack.push(value)
                return stack


            if __name__ == "__main__":
                demo = solve([1, 2, 3, 4])
                print(demo)
                print("Snapshot:", demo.snapshot())
            """
        ).strip()


class HeuristicReviewBuilder:
    """Fallback reviewer used when Claude is unavailable."""

    def __init__(self) -> None:
        self.stack_builder = StackTemplateBuilder()

    def build(
        self,
        *,
        original_code: str,
        problem_statement: Optional[str],
        profile: UserProfileData,
        variant: bool = False,
    ) -> ReviewPackage:
        summary = problem_statement or "General Python lab assignment."
        issues = [
            ReviewIssue(
                title="Ensure array-based stack semantics",
                severity="medium",
                detail="Use a pre-sized Python list and guard against overflow/underflow.",
                suggestion="Maintain an explicit top pointer instead of relying on file I/O.",
            )
        ]

        lowered = f"{original_code}\n{summary}".lower()
        if "stack" in lowered:
            improved_code = (
                self.stack_builder.build_variant_template(summary)
                if variant
                else self.stack_builder.build_base_template(summary)
            )
            issues.append(
                ReviewIssue(
                    title="Removed file operations",
                    severity="high",
                    detail="The improved code removes any file/disk access to satisfy validator rules.",
                    suggestion="Keep everything in-memory per lab manual.",
                )
            )
        else:
            improved_code = self._sanitize_generic(original_code)
            issues.append(
                ReviewIssue(
                    title="Formatting & guard clauses",
                    severity="low",
                    detail="The fallback keeps your logic but enforces snake_case and guard clauses.",
                    suggestion="Run black/ruff locally for deeper cleanup.",
                )
            )

        return ReviewPackage(
            summary=f"Automated review summary: {summary}",
            issues=issues,
            improved_code=improved_code,
            source="heuristic",
            variant_label="fallback_variant" if variant else None,
        )

    @staticmethod
    def _sanitize_generic(code: str) -> str:
        cleaned = re.sub(r"open\s*\(.*?\)", "# removed file operation", code)
        cleaned = re.sub(r"import\s+(os|subprocess|pathlib|shutil).*", "# removed restricted import", cleaned)
        return cleaned.strip()


class CodeReviewService:
    """Coordinates file validation, Claude calls, fallback logic, and personalization."""

    def __init__(self) -> None:
        self.validator = CodeSafetyValidator()
        self.profile_service = UserProfileService()
        self.claude_client = ClaudeClient()
        self.personalizer = PersonalizedCodeFormatter()
        self.heuristic_builder = HeuristicReviewBuilder()

    async def review_code(
        self,
        *,
        user: User,
        db: Session,
        filename: str,
        code_bytes: bytes,
        problem_statement: Optional[str] = None,
    ) -> Dict[str, Any]:
        self._ensure_python_file(filename)
        code_text = self._decode_code(code_bytes)
        self._enforce_code_length(code_text)

        validation_issues = self.validator.inspect(code_text)
        profile = self.profile_service.get_or_create_profile(db, user)
        package = await self._request_ai_package(
            original_code=code_text,
            problem_statement=problem_statement,
            profile=profile,
            validation_issues=validation_issues,
            variant=False,
        )
        if not package:
            package = self.heuristic_builder.build(
                original_code=code_text,
                problem_statement=problem_statement,
                profile=profile,
                variant=False,
            )

        return self._build_response(
            package=package,
            profile=profile,
            validation_issues=validation_issues,
            original_code=code_text,
            problem_statement=problem_statement,
            regenerated=False,
            variant_of=None,
            filename=filename,
        )

    async def generate_variant(
        self,
        *,
        user: User,
        db: Session,
        original_code: str,
        problem_statement: Optional[str],
        variant_of: Optional[str],
    ) -> Dict[str, Any]:
        self._enforce_code_length(original_code)
        validation_issues = self.validator.inspect(original_code)
        profile = self.profile_service.get_or_create_profile(db, user)

        package = await self._request_ai_package(
            original_code=original_code,
            problem_statement=problem_statement,
            profile=profile,
            validation_issues=validation_issues,
            variant=True,
        )
        if not package:
            package = self.heuristic_builder.build(
                original_code=original_code,
                problem_statement=problem_statement,
                profile=profile,
                variant=True,
            )

        return self._build_response(
            package=package,
            profile=profile,
            validation_issues=validation_issues,
            original_code=original_code,
            problem_statement=problem_statement,
            regenerated=True,
            variant_of=variant_of,
            filename="inline.py",
        )

    async def _request_ai_package(
        self,
        *,
        original_code: str,
        problem_statement: Optional[str],
        profile: UserProfileData,
        validation_issues: List[ReviewIssue],
        variant: bool,
    ) -> Optional[ReviewPackage]:
        prompt = self._build_user_prompt(
            original_code=original_code,
            problem_statement=problem_statement,
            profile=profile,
            validation_issues=validation_issues,
            variant=variant,
        )
        system_prompt = (
            "You are a strict Python lab reviewer. "
            "Return JSON with keys summary, issues (array with title, severity, detail, suggestion), "
            "and improved_code (string). The improved code MUST avoid file/network operations."
        )
        raw_response = await self.claude_client.generate(
            system_prompt=system_prompt,
            user_prompt=prompt,
            temperature=0.35 if variant else 0.15,
        )
        if not raw_response:
            return None
        try:
            payload = self._extract_json(raw_response)
            summary = payload.get("summary") or "AI review summary"
            issues = [
                ReviewIssue(
                    title=item.get("title", "Issue"),
                    severity=item.get("severity", "medium"),
                    detail=item.get("detail", ""),
                    suggestion=item.get("suggestion", ""),
                )
                for item in payload.get("issues", [])
                if isinstance(item, dict)
            ]
            improved_code = payload.get("improved_code")
            if not improved_code:
                return None
            return ReviewPackage(
                summary=summary,
                issues=issues,
                improved_code=improved_code.strip(),
                source="claude",
                variant_label="claude_variant" if variant else None,
            )
        except json.JSONDecodeError:
            return None

    def _build_user_prompt(
        self,
        *,
        original_code: str,
        problem_statement: Optional[str],
        profile: UserProfileData,
        validation_issues: List[ReviewIssue],
        variant: bool,
    ) -> str:
        notices = "\n".join(
            f"- {issue.title}: {issue.detail}" for issue in validation_issues
        ) or "No validator findings."
        variant_text = (
            "Generate a different approach than previously suggested while keeping output identical."
            if variant
            else "Provide a safe, ready-to-submit solution."
        )
        return textwrap.dedent(
            f"""
            Student profile:
              - Name: {profile.name}
              - Age: {profile.age}
              - Course: {profile.course}
              - Institution: {profile.institution}
              - City: {profile.city}

            Assignment prompt: {problem_statement or "Python lab assignment"}

            Validator findings:
            {notices}

            Instructions:
            - {variant_text}
            - No file, OS, or network operations.
            - Use list/array semantics for stacks when mentioned.

            Original code:
            ```python
            {original_code}
            ```
            """
        ).strip()

    @staticmethod
    def _extract_json(raw_response: str) -> Dict[str, Any]:
        match = re.search(r"\{.*\}", raw_response, re.DOTALL)
        if not match:
            raise json.JSONDecodeError("No JSON block", raw_response, 0)
        return json.loads(match.group(0))

    def _build_response(
        self,
        *,
        package: ReviewPackage,
        profile: UserProfileData,
        validation_issues: List[ReviewIssue],
        original_code: str,
        problem_statement: Optional[str],
        regenerated: bool,
        variant_of: Optional[str],
        filename: str,
    ) -> Dict[str, Any]:
        review_id = str(uuid.uuid4())
        combined_issues = package.issues + validation_issues
        personalized_code = self.personalizer.apply(package.improved_code, profile)

        return {
            "review_id": review_id,
            "variant_of": variant_of,
            "regenerated": regenerated,
            "original_filename": filename,
            "problem_statement": problem_statement or "Not provided",
            "summary": package.summary,
            "issues": [issue.as_dict() for issue in combined_issues],
            "validation_notices": [issue.as_dict() for issue in validation_issues],
            "improved_code": package.improved_code,
            "personalized_code": personalized_code,
            "original_code": original_code,
            "model_source": package.source,
            "variant_label": package.variant_label,
            "user_profile": profile.as_dict(),
        }

    @staticmethod
    def _ensure_python_file(filename: str) -> None:
        if not filename.lower().endswith(".py"):
            raise ValueError("Only .py files are supported for code review.")

    @staticmethod
    def _decode_code(code_bytes: bytes) -> str:
        for encoding in ("utf-8", "latin-1"):
            try:
                return code_bytes.decode(encoding)
            except UnicodeDecodeError:
                continue
        raise ValueError("Could not decode the uploaded file. Please use UTF-8 encoding.")

    @staticmethod
    def _enforce_code_length(code_text: str) -> None:
        max_length = getattr(settings, "MAX_CODE_LENGTH", 5000)
        if len(code_text) > max_length:
            raise ValueError(f"Code is too long ({len(code_text)} chars). Limit: {max_length} chars.")

