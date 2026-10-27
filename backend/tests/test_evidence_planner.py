import tempfile
import unittest
from pathlib import Path

from PIL import Image

from app.services.evidence_planner import plan_experiment, select_evidence, verification_summary
from app.services.screenshot_service import screenshot_service


class EvidencePlannerTests(unittest.TestCase):
    def test_java_console_negations_do_not_request_a_gui(self):
        for instruction in ('No GUI or external libraries are required.',
                            'Use Scanner without Swing.', 'GUI is not required.', 'No Swing or AWT.'):
            plan=plan_experiment('Write a Java console factorial program. '+instruction,'java')
            self.assertEqual(plan['category'],'console')
        plan=plan_experiment('Create a Java Swing calculator. No external libraries required.','java')
        self.assertEqual(plan['category'],'java_swing')

    def test_verification_timing_does_not_invent_intermediate_states(self):
        plan=plan_experiment('Test the button before marking this exercise verified. Capture the page after the successful interaction.','html')
        self.assertFalse(plan['intermediate_required'])
        for objective in ('Capture before and after submitting the form.',
                          'Show invalid input and successful submission.',
                          'Show invalid input. Then show successful submission.',
                          'Capture the initial state before submission. Show the state after submission.'):
            self.assertTrue(plan_experiment(objective,'html')['intermediate_required'])

    def test_gui_requirement_survives_console_code_substitution(self):
        plan = plan_experiment("Create a Java Swing calculator", "java", 'public class Main{public static void main(String[]args){System.out.print(5);}}')
        self.assertEqual(plan["category"], "java_swing")
        self.assertTrue(plan["supported"])
        self.assertEqual(verification_summary(plan,True,'5')['checks']['gui'],'unverified')
        self.assertIn("gui", plan["recommended_screenshots"])

    def test_no_expected_output_means_execution_only(self):
        plan = plan_experiment("Write a Python loop", "python")
        assessment = verification_summary(plan, True, "wrong output")
        self.assertEqual(assessment["status"], "execution_tested")
        self.assertEqual(assessment["checks"]["output"], "not_specified")
        self.assertTrue(plan["uncertainties"])

    def test_gui_expected_number_uses_actual_ui_observation_not_console_or_substring(self):
        plan=plan_experiment('Java Swing calculator. Expected output: 5','java')
        for actual,status in [('5','passed'),('15','failed'),('23','failed')]:
            verification={'kind':'gui','status':'passed','required':True,'tests':[{'status':'passed','observed_text':'Result: '+actual}]}
            summary=verification_summary(plan,True,'',verification)
            self.assertEqual(summary['checks']['output'],status)

    def test_explicit_expected_output_rejects_wrong_and_missing_output(self):
        plan = plan_experiment("Print the sum. Expected output: 5", "c")
        for output in ("15", "-5", "", "5\nwrong final result"):
            self.assertEqual(verification_summary(plan, True, output)["status"], "failed")
        self.assertEqual(verification_summary(plan, True, "5\n")["status"], "verified")

    def test_database_evidence_cannot_be_replaced_by_a_screenshot(self):
        plan = plan_experiment("Create a Node.js API that inserts a row into a database", "node")
        self.assertEqual(verification_summary(plan, True, "saved")["checks"]["database"], "unverified")

    def test_api_cannot_be_verified_by_printing_a_fake_http_response(self):
        plan = plan_experiment("Create a Node.js REST API", "node", "console.log('HTTP 200')")
        summary = verification_summary(plan, True, "HTTP 200")
        self.assertEqual(summary["status"], "failed")
        self.assertEqual(summary["checks"]["http"], "unverified")
        self.assertEqual(verification_summary(plan, True, "HTTP 200", {"kind": "http", "status": "passed"})["checks"]["http"], "passed")

    def test_duplicate_and_missing_evidence_are_experiment_local(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "actual.png"
            Image.new("RGB", (320, 200), "white").save(path)
            plan = plan_experiment("Write a C program", "c")
            candidate = {"path": str(path), "kind": "terminal"}
            selection = select_evidence(plan, [candidate, candidate])
            self.assertEqual(len(selection["selected"]), 1)
            self.assertEqual(len(selection["redundant"]), 1)
            self.assertEqual(selection["missing_requirements"], ["source"])
            self.assertEqual(len(select_evidence(plan, [candidate])["selected"]), 1)

    def test_corrupt_image_is_not_embeddable_evidence(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "corrupt.png"
            path.write_bytes(b"not an image")
            result = select_evidence(plan_experiment("Run a program", "python"), [{"path": str(path), "kind": "terminal"}])
            self.assertEqual(len(result["invalid"]), 1)


class EvidenceTemplateTests(unittest.IsolatedAsyncioTestCase):
    async def test_no_fabricated_success_time_or_executable_path(self):
        rendered = await screenshot_service._render_template("", "compiler failed", "codeblocks", error="compiler failed", view_mode="output")
        self.assertNotIn("Process returned 0", rendered)
        self.assertNotIn("0.042 s", rendered)

    async def test_evidence_template_escapes_output_and_discloses_source_preview(self):
        rendered = await screenshot_service._render_template("", "<b>untrusted output</b>", "vscode", presentation="evidence", view_mode="output")
        self.assertIn("&lt;b&gt;untrusted output&lt;/b&gt;", rendered)
        self.assertNotIn("box-shadow", rendered)
        source = await screenshot_service._render_template("", "", "idle", source_code="print(5)", presentation="evidence", view_mode="editor")
        self.assertIn("Rendered source preview", source)
