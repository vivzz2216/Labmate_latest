"""Waiting room: at most ADMISSION_MAX_ACTIVE signed-in students use the app at once.

Everyone can sign in. A student who signs in while the app is full is put in a first-in-first-out waiting list and sees their place; when a
slot frees up the first waiter is given a short claim window (so nobody can jump the line), the page admits them and notifies them.

"Active" means the student's browser has checked in within LEASE seconds (the page checks in every 30 s while it is open), so closing the tab
frees the slot. A waiting student must keep the page open too: a spot is not kept for someone who has left.

State lives in this process. With several API replicas, give every replica the same limit divided by the replica count, or move the state to
Redis; with the default single replica this is exact.
"""
import math
import threading
import time
from collections import OrderedDict, deque


class AdmissionGate:
    def __init__(self, limit=150, lease=120, claim=90, wait_lease=180, clock=time.monotonic):
        self.limit, self.lease, self.claim, self.wait_lease = int(limit), int(lease), int(claim), int(wait_lease)
        self.clock = clock
        self._lock = threading.Lock()
        self._active = {}                    # user id -> last check-in
        self._reserved = {}                  # user id -> claim expiry (slot held for the first waiter)
        self._waiting = OrderedDict()        # user id -> last check-in, in line order
        self._releases = deque(maxlen=30)    # times slots became free, to estimate the wait

    # ---- housekeeping (call with the lock held)
    def _expire(self, now):
        for uid, seen in list(self._active.items()):
            if now - seen > self.lease:
                del self._active[uid]
                self._releases.append(now)
        for uid, until in list(self._reserved.items()):
            if now > until:
                del self._reserved[uid]
                self._releases.append(now)
        for uid, seen in list(self._waiting.items()):
            if now - seen > self.wait_lease:
                del self._waiting[uid]

    def _promote(self, now):
        while self._waiting and len(self._active) + len(self._reserved) < self.limit:
            uid, _ = self._waiting.popitem(last=False)
            self._reserved[uid] = now + self.claim

    def _estimate(self, position, now):
        """Seconds until a place frees up for this position, from how fast slots have been freeing recently."""
        gaps = [b - a for a, b in zip(self._releases, list(self._releases)[1:]) if b >= a]
        per_slot = (sum(gaps) / len(gaps)) if gaps else 45.0
        return int(math.ceil(position * min(max(per_slot, 5.0), 600.0)))

    def _view(self, status, position, now):
        return {"enabled": True, "status": status, "position": position, "waiting": len(self._waiting), "active": len(self._active) + len(self._reserved),
                "limit": self.limit, "estimated_wait_seconds": self._estimate(position, now) if status == "waiting" else 0}

    # ---- public
    def enter(self, uid):
        """Check in (also the heartbeat). Returns {'status': 'active'|'waiting', 'position': n, ...}."""
        with self._lock:
            now = self.clock()
            self._expire(now)
            if uid in self._active:
                self._active[uid] = now
                self._promote(now)
                return self._view("active", 0, now)
            if uid in self._reserved:                           # the claimed slot: step in
                del self._reserved[uid]
                self._active[uid] = now
                self._promote(now)
                return self._view("active", 0, now)
            if uid in self._waiting:
                self._waiting[uid] = now
            elif not self._waiting and len(self._active) + len(self._reserved) < self.limit:
                self._active[uid] = now
                return self._view("active", 0, now)
            else:
                self._waiting[uid] = now                        # join the end of the line
            self._promote(now)
            if uid in self._reserved:
                del self._reserved[uid]
                self._active[uid] = now
                return self._view("active", 0, now)
            position = list(self._waiting).index(uid) + 1
            return self._view("waiting", position, now)

    def leave(self, uid):
        with self._lock:
            now = self.clock()
            if self._active.pop(uid, None) is not None or self._reserved.pop(uid, None) is not None:
                self._releases.append(now)
            self._waiting.pop(uid, None)
            self._expire(now)
            self._promote(now)

    def is_active(self, uid):
        with self._lock:
            now = self.clock()
            self._expire(now)
            return uid in self._active or uid in self._reserved

    def snapshot(self):
        with self._lock:
            now = self.clock()
            self._expire(now)
            return {"active": len(self._active), "reserved": len(self._reserved), "waiting": len(self._waiting), "limit": self.limit}


_gate = None
_gate_key = None


def get_gate():
    """The process-wide gate, rebuilt if the configured limits change (tests, restarts with new settings)."""
    global _gate, _gate_key
    from ..config import settings
    key = (settings.ADMISSION_MAX_ACTIVE, settings.ADMISSION_LEASE_SECONDS, settings.ADMISSION_CLAIM_SECONDS)
    if _gate is None or key != _gate_key:
        _gate = AdmissionGate(*key)
        _gate_key = key
    return _gate


def enabled():
    from ..config import settings
    return bool(settings.ADMISSION_ENABLED)


def exempt(user):
    from ..security.operator_access import is_user_credit_exempt
    return is_user_credit_exempt(user)
