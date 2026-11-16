"""A server/client Java run records independent evidence that two processes really ran and exchanged output."""
import asyncio
import shutil
import tempfile
from pathlib import Path

import pytest

from app.services.dc_runtime import execute_distributed_java
from app.services.evidence_planner import plan_experiment, verification_summary

pytestmark = pytest.mark.skipif(not shutil.which("javac") or not shutil.which("java"), reason="a JDK is required")

SERVER = """// File: PingServer.java
import java.io.*; import java.net.*;
public class PingServer { public static void main(String[] a) throws Exception {
  try (ServerSocket s = new ServerSocket(5071)) { System.out.println("Ping server up");
    try (Socket c = s.accept(); BufferedReader in = new BufferedReader(new InputStreamReader(c.getInputStream())); PrintWriter out = new PrintWriter(c.getOutputStream(), true)) {
      out.println("PONG " + in.readLine()); } } } }
"""
CLIENT = """// File: PingClient.java
import java.io.*; import java.net.*;
public class PingClient { public static void main(String[] a) throws Exception {
  Socket sock = null; for (int i = 0; i < 50 && sock == null; i++) { try { sock = new Socket("localhost", 5071); } catch (ConnectException e) { Thread.sleep(100); } }
  try (Socket s = sock; BufferedReader in = new BufferedReader(new InputStreamReader(s.getInputStream())); PrintWriter out = new PrintWriter(s.getOutputStream(), true)) {
    out.println("hello"); System.out.println("Reply: " + in.readLine()); } } }
"""


def run(code):
    with tempfile.TemporaryDirectory() as directory:
        return asyncio.run(execute_distributed_java(code, Path(directory), stdin=None, timeout=40))


def test_server_and_client_run_is_independently_verified():
    result = run(SERVER + "\n" + CLIENT)
    assert result.success and "Reply: PONG hello" in result.output
    assert result.verification["status"] == "passed"
    assert [t["status"] for t in result.verification["tests"]] == ["passed", "passed", "passed"]
    plan = plan_experiment("EXPERIMENT NO. 1: Ping\nWrite a server and a client using sockets.\nExpected output (client):\nReply: PONG hello", "distributed")
    summary = verification_summary(plan, True, result.output, result.verification)
    assert summary["status"] == "verified" and summary["checks"]["output"] == "passed"
