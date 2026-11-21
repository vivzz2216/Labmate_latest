"""Run a Python script from the editor using the existing isolated lab runtime."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..middleware.csrf import require_csrf_token
from ..security.execution_access import execution_user
from .ide_java import clip, run_editor_program

router = APIRouter(prefix="/ide/python", tags=["ide-python"])


class PythonRunInput(BaseModel):
    code: str = Field(min_length=1, max_length=40_000)
    stdin: str = Field(default="", max_length=8_000)


@router.post("/run")
async def run_python(body: PythonRunInput, user=Depends(execution_user), csrf=Depends(require_csrf_token)):
    result = await run_editor_program(user.id, body.code, "python", body.stdin)
    return {"success": bool(result.success), "stdout": clip(result.output),
            "stderr": clip(result.error), "exit_code": result.exit_code}
