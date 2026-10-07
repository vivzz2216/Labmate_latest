import os
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from app.services.runtime_engine import RuntimeEngine, make_resource_limiter


class ExecutionSandboxTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.engine = RuntimeEngine()

    async def test_python_dangerous_code_rejected_statically(self):
        dangerous_python = "__import__('os').system('whoami')"
        result = await self.engine.execute(dangerous_python, "python")
        self.assertFalse(result.success)
        self.assertEqual(result.exit_code, 126)
        self.assertIn("Security policy violation", result.error)

    async def test_java_system_access_rejected_statically(self):
        dangerous_java = (
            "public class Exploit {\n"
            "    public static void main(String[] args) {\n"
            "        Runtime.getRuntime().exec(\"shutdown\");\n"
            "    }\n"
            "}"
        )
        result = await self.engine.execute(dangerous_java, "java")
        self.assertFalse(result.success)
        self.assertEqual(result.exit_code, 126)
        self.assertIn("Security policy violation", result.error)

    async def test_c_fork_bomb_rejected_statically(self):
        dangerous_c = (
            "#include <unistd.h>\n"
            "int main() {\n"
            "    while(1) { fork(); }\n"
            "    return 0;\n"
            "}"
        )
        result = await self.engine.execute(dangerous_c, "c")
        self.assertFalse(result.success)
        self.assertEqual(result.exit_code, 126)
        self.assertIn("Security policy violation", result.error)

    async def test_cpp_system_call_rejected_statically(self):
        dangerous_cpp = (
            "#include <cstdlib>\n"
            "#include <iostream>\n"
            "int main() {\n"
            "    system(\"rm -rf /\");\n"
            "    return 0;\n"
            "}"
        )
        result = await self.engine.execute(dangerous_cpp, "cpp")
        self.assertFalse(result.success)
        self.assertEqual(result.exit_code, 126)
        self.assertIn("Security policy violation", result.error)

    async def test_comments_and_strings_do_not_trigger_false_positives(self):
        safe_c_with_system_word = (
            "#include <stdio.h>\n"
            "// This program explains the operating system concepts\n"
            "int main() {\n"
            "    printf(\"Database Management System\\n\");\n"
            "    return 0;\n"
            "}"
        )
        # Should not be rejected by the security policy validator
        from app.security.generated_code import validate_generated_code
        # Should not raise ValueError
        validate_generated_code(safe_c_with_system_word, "c")

    def test_make_resource_limiter_applies_all_posix_bounds(self):
        mock_resource = MagicMock()
        mock_resource.RLIMIT_AS = 9
        mock_resource.RLIMIT_CPU = 0
        mock_resource.RLIMIT_FSIZE = 1
        mock_resource.RLIMIT_CORE = 4
        mock_resource.RLIMIT_NPROC = 6

        limits = {
            "max_memory_bytes": 512 * 1024 * 1024,
            "max_cpu_seconds": 15,
            "max_filesize_bytes": 20 * 1024 * 1024,
            "max_procs": 64,
        }

        with patch("app.services.runtime_engine.resource", mock_resource), \
             patch("os.setsid", create=True) as mock_setsid:
            preexec = make_resource_limiter(limits)
            preexec()

            mock_setsid.assert_called_once()
            # Assert setrlimit was called for AS, CPU, FSIZE, CORE, NPROC
            called_resources = [call.args[0] for call in mock_resource.setrlimit.call_args_list]
            self.assertIn(mock_resource.RLIMIT_AS, called_resources)
            self.assertIn(mock_resource.RLIMIT_CPU, called_resources)
            self.assertIn(mock_resource.RLIMIT_FSIZE, called_resources)
            self.assertIn(mock_resource.RLIMIT_CORE, called_resources)
            self.assertIn(mock_resource.RLIMIT_NPROC, called_resources)
