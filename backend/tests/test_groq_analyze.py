import unittest
from unittest.mock import AsyncMock, patch

from app.config import settings
from app.services.analysis_service import analysis_service, normalize_generated_code
from app.services.generation_service import GenerationError


class GroqAnalysisTests(unittest.IsolatedAsyncioTestCase):
    def test_double_escaped_source_preserves_newline_inside_string(self):
        source = r'#include <stdio.h>\nint main(){printf(\"Hello\\n\");return 0;}'
        fixed = normalize_generated_code(source)
        self.assertIn("#include <stdio.h>\nint main()", fixed)
        self.assertIn('printf("Hello\\n")', fixed)

    async def test_analyze_routes_to_selected_gpt_oss_provider(self):
        tasks = [{"id": i, "question_text": f"Write a C++ program for task {i}", "detected_language": "cpp"}
                 for i in (1, 2, 3)]
        solutions = {"solutions": [{"id": i, "code": f"int main() {{ return {i}; }}"} for i in (1, 2, 3)]}
        with patch.object(settings, "LLM_PROVIDER", "groq"), \
             patch("app.services.analysis_service.parser_service.parse_file", AsyncMock(return_value=tasks)), \
             patch("app.services.generation_service.generation_service.generate_json", AsyncMock(return_value=solutions)) as model:
            candidates = await analysis_service.analyze_document("manual.docx", "docx")
        self.assertEqual(len(candidates), 3)
        self.assertEqual([item["task_id"] for item in candidates], ["1", "2", "3"])
        self.assertTrue(all(item["suggested_code"].startswith("int main") for item in candidates))
        self.assertIn("cin", model.await_args.args[0])

    async def test_incomplete_model_response_is_not_reported_as_pass(self):
        with patch.object(settings, "LLM_PROVIDER", "groq"), \
             patch("app.services.analysis_service.parser_service.parse_file", AsyncMock(return_value=[
                 {"id": 1, "question_text": "Write a Python program", "detected_language": "python"}])), \
             patch("app.services.generation_service.generation_service.generate_json", AsyncMock(return_value={"solutions": []})):
            with self.assertRaises(ValueError):
                await analysis_service.analyze_document("manual.docx", "docx")

    async def test_bad_batch_schema_falls_back_to_one_question_per_request(self):
        tasks = [{"id": i, "question_text": f"Write Python program {i}", "detected_language": "python"}
                 for i in (1, 2, 3)]
        answers = [GenerationError("Groq rejected the request (HTTP 400)."),
                   *({"code": f"print({i})", "stdin": ""} for i in (1, 2, 3))]
        with patch.object(settings, "LLM_PROVIDER", "groq"), \
             patch("app.services.analysis_service.parser_service.parse_file", AsyncMock(return_value=tasks)), \
             patch("app.services.generation_service.generation_service.generate_json",
                   AsyncMock(side_effect=answers)) as model:
            candidates = await analysis_service.analyze_document("manual.docx", "docx")
        self.assertEqual(len(candidates), 3)
        self.assertEqual(model.await_count, 4)
