"""Windows kernel-enforced process count, memory and process-tree cleanup."""
import ctypes
from ctypes import wintypes


def attach_windows_job(process, memory_bytes=2*1024**3):
    class Basic(ctypes.Structure):
        _fields_=[('process_time',ctypes.c_int64),('job_time',ctypes.c_int64),('flags',wintypes.DWORD),
            ('minimum',ctypes.c_size_t),('maximum',ctypes.c_size_t),('processes',wintypes.DWORD),
            ('affinity',ctypes.c_size_t),('priority',wintypes.DWORD),('scheduling',wintypes.DWORD)]
    class Counters(ctypes.Structure):
        _fields_=[(name,ctypes.c_uint64) for name in ('read_ops','write_ops','other_ops','read_bytes','write_bytes','other_bytes')]
    class Extended(ctypes.Structure):
        _fields_=[('basic',Basic),('io',Counters),('process_memory',ctypes.c_size_t),('job_memory',ctypes.c_size_t),
                  ('peak_process',ctypes.c_size_t),('peak_job',ctypes.c_size_t)]
    kernel=ctypes.WinDLL('kernel32',use_last_error=True)
    kernel.CreateJobObjectW.argtypes=[ctypes.c_void_p,wintypes.LPCWSTR];kernel.CreateJobObjectW.restype=wintypes.HANDLE
    kernel.SetInformationJobObject.argtypes=[wintypes.HANDLE,ctypes.c_int,ctypes.c_void_p,wintypes.DWORD]
    kernel.SetInformationJobObject.restype=wintypes.BOOL
    kernel.AssignProcessToJobObject.argtypes=[wintypes.HANDLE,wintypes.HANDLE];kernel.AssignProcessToJobObject.restype=wintypes.BOOL
    kernel.CloseHandle.argtypes=[wintypes.HANDLE]
    handle=kernel.CreateJobObjectW(None,None)
    if not handle:raise RuntimeError('Could not create notebook resource limits.')
    # Windows venv launchers may start one base-interpreter child.
    limits=Extended();limits.basic.flags=0x2000|0x100|0x8;limits.basic.processes=2;limits.process_memory=memory_bytes
    if not kernel.SetInformationJobObject(handle,9,ctypes.byref(limits),ctypes.sizeof(limits)) or not kernel.AssignProcessToJobObject(handle,wintypes.HANDLE(int(process._handle))):
        error=ctypes.get_last_error();kernel.CloseHandle(handle)
        raise RuntimeError(f'Could not apply notebook process/memory limits (Windows error {error}).')
    def close():kernel.CloseHandle(handle)
    def ensure_pid(pid):
        kernel.OpenProcess.argtypes=[wintypes.DWORD,wintypes.BOOL,wintypes.DWORD];kernel.OpenProcess.restype=wintypes.HANDLE
        kernel.IsProcessInJob.argtypes=[wintypes.HANDLE,wintypes.HANDLE,ctypes.POINTER(wintypes.BOOL)]
        target=kernel.OpenProcess(0x1000|0x100|0x1,False,pid)
        if not target:raise RuntimeError('Cannot verify notebook worker limits.')
        try:
            attached=wintypes.BOOL()
            if not kernel.IsProcessInJob(target,handle,ctypes.byref(attached)):raise RuntimeError('Cannot inspect notebook worker job.')
            if not attached and not kernel.AssignProcessToJobObject(handle,target):raise RuntimeError('Cannot limit the notebook interpreter process.')
        finally:kernel.CloseHandle(target)
    close.ensure_pid=ensure_pid
    return close
