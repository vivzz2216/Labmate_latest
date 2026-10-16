"""Regression cases found while reviewing standalone HTML verification."""

import copy
import tempfile
import unittest
from unittest.mock import patch

from app.services.assignment_workflow import interaction_required
from app.services.runtime_engine import expected_text_is_visible, normalize_browser_tests, runtime_engine


ADD_PAGE = '''<!doctype html><label>First<input id="a" type="number"></label>
<label>Second<input id="b" type="number"></label><button>Add</button><output></output>
<script>
const a = document.querySelector('#a');
const b = document.querySelector('#b');
document.querySelector('button').addEventListener('click', () => {
  document.querySelector('output').textContent = Number(a.value) + Number(b.value);
});
</script>'''
ADD_TEST = {"name": "Add numbers", "actions": [
    {"action": "fill", "locator_type": "label", "locator": "First", "role": "", "value": "2"},
    {"action": "fill", "locator_type": "label", "locator": "Second", "role": "", "value": "3"},
    {"action": "click", "locator_type": "role", "locator": "Add", "role": "button", "value": ""},
], "expected_text": ["5"]}


class InteractionClassificationTests(unittest.TestCase):
    def test_calculator_task_requires_verification_without_button_keyword(self):
        self.assertTrue(interaction_required("Build a JavaScript calculator that adds two numbers."))
        self.assertFalse(interaction_required("Create a static HTML biography with headings and images."))

    def test_positive_number_does_not_match_negative_or_scientific_result(self):
        for wrong in ("Result: -5", "Result: 5e2", "Result: 15", "Result: 5.2"):
            self.assertFalse(expected_text_is_visible(wrong, "5"), wrong)
        self.assertTrue(expected_text_is_visible("Result: 5", "5"))

    def test_test_plan_rejects_executable_scripts_and_excess_steps(self):
        for plan in ("page.click('Add')", [{"script": "alert(1)"}], [ADD_TEST] * 4):
            tests, error = normalize_browser_tests(plan)
            self.assertEqual(tests, [])
            self.assertTrue(error)
        oversized = copy.deepcopy(ADD_TEST)
        oversized["actions"] *= 3
        self.assertTrue(normalize_browser_tests([oversized])[1])


class BrowserInteractionReviewTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        for key in ("SCREENSHOT_DIR", "REACT_TEMP_DIR"):
            patcher = patch("app.services.runtime_engine.settings." + key, self.folder.name)
            patcher.start()
            self.addCleanup(patcher.stop)

    async def test_two_scenarios_get_fresh_javascript_state_and_keep_steps(self):
        second = copy.deepcopy(ADD_TEST)
        second["name"] = "Different sum"
        second["actions"][0]["value"] = "7"
        second["expected_text"] = ["10"]
        result = await runtime_engine.execute(ADD_PAGE, "html", browser_tests=[ADD_TEST, second],
                                              interaction_is_required=True)
        self.assertTrue(result.success, result.error)
        self.assertEqual(len(result.verification["tests"]), 2)
        self.assertEqual(result.verification["tests"][0]["actions"], ADD_TEST["actions"])
        self.assertEqual(set(result.screenshots), {"/", "/test-2"})

    async def test_supplied_plan_runs_even_without_question_heuristic(self):
        result = await runtime_engine.execute(ADD_PAGE, "html", browser_tests=[ADD_TEST])
        self.assertTrue(result.success, result.error)
        self.assertEqual(result.verification["status"], "passed")

    async def test_interactive_dom_without_a_plan_is_unverified(self):
        result = await runtime_engine.execute(ADD_PAGE, "html")
        self.assertFalse(result.success)
        self.assertTrue(result.verification["required"])

    async def test_hidden_output_cannot_satisfy_visible_assertion(self):
        page = ADD_PAGE.replace('<output>', '<output style="opacity:0">')
        result = await runtime_engine.execute(page, "html", browser_tests=[ADD_TEST],
                                              interaction_is_required=True)
        self.assertFalse(result.success)

    async def test_hung_handler_hits_cumulative_timeout_and_returns_failure(self):
        page = '<button onclick="while(true){}">Add</button>'
        test = {"name": "Hung button", "actions": [ADD_TEST["actions"][-1]], "expected_text": ["5"]}
        with patch("app.services.runtime_engine._HTML_INTERACTION_SECONDS", .3):
            result = await runtime_engine.execute(page, "html", browser_tests=[test], interaction_is_required=True)
        self.assertFalse(result.success)
        self.assertEqual(result.verification["status"], "failed")
        self.assertIn("time limit", result.error)

