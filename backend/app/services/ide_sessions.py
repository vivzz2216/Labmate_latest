"""One kept Railway sandbox per student for the IDE replicas (Eclipse, IntelliJ).

Every new sandbox VM spends ~14-56 Railway API requests (create, status polls while it boots, destroy) out of
the account's hourly allowance (1,000 on Hobby), and the Run button used to create one per click: about 70
clicks in an hour blocked code execution for every student. A student's runs now share one VM while they keep
working; their first Run boots it (~60 s), later runs take seconds and cost no API requests. Each program still
runs in its own namespaces with fresh /work and /tmp inside the VM, so runs never see each other's files.
"""
import asyncio
import logging
import time
from contextlib import asynccontextmanager

from ..config import settings
from . import railway_sandbox

logger = logging.getLogger(__name__)

# Railway destroys a VM after 5 idle minutes (bridge.mjs idleTimeoutMinutes); close ours first.
IDLE_SECONDS = 240
# Kept VMs at once across all students; the least recently used is closed to make room.
MAX_SESSIONS = 12
REAP_EVERY_SECONDS = 30


class IdeSessions:
    def __init__(self):
        self._sessions = {}  # user id -> {'session', 'last_used', 'active'}
        self._reaper = None
        self._closing = set()  # keep references to background closes

    @asynccontextmanager
    async def use(self, user_id):
        """Run the block with this student's kept sandbox (Railway sandboxes only)."""
        if settings.EXECUTION_BACKEND != 'railway_sandbox':
            yield None
            return
        loop = asyncio.get_running_loop()
        entry = self._sessions.get(user_id)
        if entry is not None and entry['session'].loop is not loop:
            self._close_later(self._sessions.pop(user_id)['session'])
            entry = None
        if entry is None:
            self._make_room()
            entry = {'session': railway_sandbox.SandboxSession(), 'last_used': time.monotonic(), 'active': 0}
            self._sessions[user_id] = entry
            self._ensure_reaper()
        entry['active'] += 1
        entry['last_used'] = time.monotonic()
        try:
            with railway_sandbox.use_session(entry['session']):
                yield entry['session']
        finally:
            entry['active'] -= 1
            entry['last_used'] = time.monotonic()

    def _make_room(self):
        while len(self._sessions) >= MAX_SESSIONS:
            idle = [(e['last_used'], uid) for uid, e in self._sessions.items() if not e['active']]
            if not idle:
                return  # every kept VM is mid-run; the new one is simply one more
            _, uid = min(idle)
            self._close_later(self._sessions.pop(uid)['session'])

    def _close_later(self, session):
        task = asyncio.ensure_future(session.close())
        self._closing.add(task)
        task.add_done_callback(self._closing.discard)

    def reap(self, now=None):
        """Close sessions idle for IDLE_SECONDS. Returns how many were closed."""
        now = time.monotonic() if now is None else now
        stale = [uid for uid, e in self._sessions.items() if not e['active'] and now - e['last_used'] >= IDLE_SECONDS]
        for uid in stale:
            self._close_later(self._sessions.pop(uid)['session'])
        return len(stale)

    def _ensure_reaper(self):
        if self._reaper is None or self._reaper.done():
            self._reaper = asyncio.ensure_future(self._reap_loop())

    async def _reap_loop(self):
        while self._sessions:
            await asyncio.sleep(REAP_EVERY_SECONDS)
            try:
                self.reap()
            except Exception:  # never let the reaper die with VMs still kept
                logger.exception('IDE sandbox reaper failed')

    async def close_all(self):
        sessions = [e['session'] for e in self._sessions.values()]
        self._sessions.clear()
        if self._reaper is not None:
            self._reaper.cancel()
        await asyncio.gather(*(s.close() for s in sessions), *list(self._closing), return_exceptions=True)


ide_sessions = IdeSessions()
