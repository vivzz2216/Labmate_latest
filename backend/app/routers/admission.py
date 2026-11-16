"""Waiting room endpoints: the page checks in here when it opens and every 30 seconds while it stays open."""
from fastapi import APIRouter, Depends

from ..middleware.auth import get_current_user
from ..services import admission

router = APIRouter(prefix="/admission", tags=["admission"])


@router.post("/enter")
async def enter(user=Depends(get_current_user)):
    """Check in. `status` is "active" (use the app) or "waiting" (with `position` and an `estimated_wait_seconds`)."""
    if not admission.enabled() or admission.exempt(user):
        return {"enabled": False, "status": "active", "position": 0, "waiting": 0, "active": 0, "limit": 0, "estimated_wait_seconds": 0}
    return admission.get_gate().enter(user.id)


@router.post("/leave")
async def leave(user=Depends(get_current_user)):
    """Free the slot (or leave the line) when the student signs out or closes the app on purpose."""
    if admission.enabled():
        admission.get_gate().leave(user.id)
    return {"ok": True}


@router.get("/status")
async def status(user=Depends(get_current_user)):
    """Capacity snapshot (no check-in)."""
    if not admission.enabled():
        return {"enabled": False}
    return {"enabled": True, **admission.get_gate().snapshot()}
