"""Student-facing messages for failures; raw diagnostics remain in workflow data."""


def execution_was_not_attempted(result):
    error = str(result.get("error") or "").casefold()
    return "execution was not attempted" in error or (
        (result.get("execution_stages") or {}).get("execution") == "not_run"
    )


def student_failure_message(result):
    error = str(result.get("error") or "").casefold()
    stages = result.get("execution_stages") or {}
    if "does not match requested language" in error:
        return "The solution could not be generated in the selected language. Check the language and retry."
    if "rmi requires separate" in error:
        return "Java RMI needs separate server and client programs that run on the same machine. This solution did not provide a runnable pair."
    if stages.get("compile") == "failed" or error.startswith(("compilation error", "compiler rejected")):
        return "The program could not be compiled. Review the source and retry."
    if "gpu execution is unavailable" in error:
        return "This experiment asks for a GPU, but the lab runtime is CPU-only. Change the code to run on the CPU and retry."
    if stages.get("capture") == "unavailable" or "could not be captured" in error:
        return "The required screenshot could not be captured. Retry to generate the evidence."
    if (result.get("verification") or {}).get("status") == "failed":
        return "The captured results did not verify all of the experiment requirements."
    return "The experiment could not be completed and verified. Review the requirements and retry."
