"""Waiting room: a full app lets everyone sign in but only a limited number work at once; the rest wait in order."""
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import settings
from app.middleware.auth import get_current_user
from app.routers import admission as admission_router
from app.security.execution_access import execution_user
from app.services import admission
from app.services.admission import AdmissionGate


class Clock:
    def __init__(self): self.now = 1000.0
    def __call__(self): return self.now
    def tick(self, seconds): self.now += seconds


def make(limit=3):
    clock = Clock()
    return AdmissionGate(limit=limit, lease=120, claim=90, wait_lease=180, clock=clock), clock


def test_up_to_the_limit_are_admitted_and_the_rest_queue_in_order():
    gate, _ = make(3)
    assert [gate.enter(i)["status"] for i in (1, 2, 3)] == ["active"] * 3
    four, five, six = gate.enter(4), gate.enter(5), gate.enter(6)
    assert (four["status"], four["position"]) == ("waiting", 1)
    assert (five["position"], six["position"]) == (2, 3)
    assert four["active"] == 3 and four["limit"] == 3 and four["waiting"] == 1
    assert gate.enter(5)["position"] == 2                      # checking in again keeps the place


def test_a_freed_slot_goes_to_the_first_waiter_and_nobody_can_jump_the_line():
    gate, _ = make(2)
    gate.enter(1); gate.enter(2)
    gate.enter(3); gate.enter(4)
    gate.leave(1)                                              # one slot frees up
    assert gate.enter(9)["status"] == "waiting"                # a newcomer cannot take it
    assert gate.enter(4)["status"] == "waiting"                # 4 is second in line: still waiting
    assert gate.enter(3)["status"] == "active"                 # 3 was first and claims the slot
    assert gate.enter(4)["position"] == 1 and gate.enter(9)["position"] == 2


def test_an_unclaimed_slot_passes_to_the_next_waiter_after_the_claim_window():
    gate, clock = make(1)
    gate.enter(1); gate.enter(2); gate.enter(3)
    gate.leave(1)                                              # slot reserved for 2
    clock.tick(100)                                            # 2 never comes back; claim (90 s) lapsed
    gate.enter(3)                                              # 3 checks in, keeping its own place
    assert gate.enter(3)["status"] == "active"


def test_closing_the_tab_frees_the_slot_after_the_lease():
    gate, clock = make(1)
    gate.enter(1)
    waiting = gate.enter(2)
    assert waiting["status"] == "waiting"
    clock.tick(50); gate.enter(2)                              # 2 keeps checking in, 1 went silent
    clock.tick(80)                                             # 1 has been silent for 130 s (> 120)
    assert gate.enter(2)["status"] == "active"
    assert gate.is_active(1) is False


def test_a_waiter_who_left_loses_the_place():
    gate, clock = make(1)
    gate.enter(1); gate.enter(2); gate.enter(3)
    clock.tick(200)                                            # nobody checked in for 200 s
    gate.enter(1)
    assert gate.snapshot()["waiting"] == 0 and gate.enter(2)["status"] == "waiting"


def test_estimate_grows_with_position():
    gate, _ = make(1)
    gate.enter(1)
    first, second = gate.enter(2), gate.enter(3)
    assert 0 < first["estimated_wait_seconds"] < second["estimated_wait_seconds"]


def test_estimate_uses_recent_release_speed():
    gate, clock = make(1)
    gate.enter(1)
    for uid in range(2, 6):
        gate.enter(uid)
    for uid in range(1, 5):                                    # slots freed every 10 s
        clock.tick(10); gate.leave(uid); gate.enter(uid + 1)
    view = gate.enter(99)
    assert view["status"] == "waiting" and view["estimated_wait_seconds"] <= view["position"] * 15


@pytest.fixture()
def api(monkeypatch):
    monkeypatch.setattr(settings, "ADMISSION_ENABLED", True)
    monkeypatch.setattr(settings, "ADMISSION_MAX_ACTIVE", 2)
    admission._gate = None
    app = FastAPI()
    app.include_router(admission_router.router, prefix="/api")
    state = {"id": 1, "email": "s1@example.com"}
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=state["id"], email=state["email"], is_active=True)
    app.dependency_overrides[admission_router.get_current_user] = app.dependency_overrides[get_current_user]

    @app.get("/heavy")
    async def heavy(user=__import__("fastapi").Depends(execution_user)):
        return {"ok": True}
    app.dependency_overrides[get_current_user] = app.dependency_overrides[get_current_user]
    with TestClient(app) as client:
        client.state = state
        yield client
    admission._gate = None


def as_user(client, uid, email=None):
    client.state["id"], client.state["email"] = uid, email or f"s{uid}@example.com"


def test_endpoints_and_the_heavy_work_gate(api, monkeypatch):
    monkeypatch.setattr("app.security.execution_access.check_execution_access", lambda user: None)   # profile/beta rules are tested elsewhere
    for uid in (1, 2):
        as_user(api, uid)
        assert api.post("/api/admission/enter").json()["status"] == "active"
    as_user(api, 3)
    view = api.post("/api/admission/enter").json()
    assert view["status"] == "waiting" and view["position"] == 1 and view["limit"] == 2
    reply = api.get("/heavy")
    assert reply.status_code == 503 and reply.json()["detail"] == "high_traffic_waiting_room"
    as_user(api, 1)
    assert api.get("/heavy").status_code == 200                # an admitted student works normally
    assert api.post("/api/admission/leave").json() == {"ok": True}
    as_user(api, 3)
    assert api.post("/api/admission/enter").json()["status"] == "active"
    assert api.get("/heavy").status_code == 200


def test_disabled_gate_lets_everyone_through(monkeypatch):
    monkeypatch.setattr(settings, "ADMISSION_ENABLED", False)
    app = FastAPI()
    app.include_router(admission_router.router, prefix="/api")
    app.dependency_overrides[admission_router.get_current_user] = lambda: SimpleNamespace(id=5, email="a@example.com", is_active=True)
    with TestClient(app) as client:
        assert client.post("/api/admission/enter").json()["enabled"] is False
        assert client.post("/api/admission/enter").json()["status"] == "active"
