"""Forward private, bounded terminal input to a genuine controlling Bash PTY."""
import errno
import fcntl
import os
from pathlib import Path
import pty
import selectors
import signal
import struct
import termios

ROOT=Path('/run/labmate-console')
LIMIT=65536


def main():
    child,master=pty.fork()
    if child==0:
        os.execv('/bin/bash',['/bin/bash','--noprofile','--rcfile','/etc/labmate-console.bashrc','-i'])
    incoming=os.open(ROOT/'input',os.O_RDONLY|os.O_NONBLOCK)
    os.set_blocking(master,False)
    # A bounded queue must retain short writes; no input bytes may be dropped.
    pending=bytearray();count=0;size=None;resize=True
    def resize_signal(*_):
        nonlocal resize
        resize=True
    signal.signal(signal.SIGWINCH,resize_signal)
    selector=selectors.DefaultSelector()
    selector.register(incoming,selectors.EVENT_READ)
    selector.register(master,selectors.EVENT_READ)
    with (ROOT/'transcript').open('wb',buffering=0) as transcript,(ROOT/'keyboard').open('wb',buffering=0) as keyboard:
        try:
            while True:
                if resize:
                    resize=False
                    try:
                        dimensions=os.get_terminal_size(1);new_size=(dimensions.lines,dimensions.columns)
                    except OSError:new_size=(22,76)
                    if new_size!=size:
                        size=new_size
                        fcntl.ioctl(master,termios.TIOCSWINSZ,struct.pack('HHHH',*size,0,0))
                selector.modify(master,selectors.EVENT_READ | (selectors.EVENT_WRITE if pending else 0))
                for key,events in selector.select(.2):
                    if key.fd==incoming:
                        data=os.read(incoming,4096)
                        if data:
                            keyboard.write(data);pending.extend(data)
                            if len(pending)>8192:raise ValueError('Terminal input exceeded its queue budget.')
                    else:
                        if events & selectors.EVENT_WRITE and pending:
                            try:
                                written=os.write(master,pending)
                                del pending[:written]
                            except BlockingIOError:pass
                        if events & selectors.EVENT_READ:
                            try:data=os.read(master,4096)
                            except OSError as error:
                                if error.errno==errno.EIO:return
                                raise
                            if not data:return
                            count+=len(data)
                            if count>LIMIT:raise ValueError('Terminal output exceeded its budget.')
                            transcript.write(data)
                            view=memoryview(data)
                            while view:
                                written=os.write(1,view);view=view[written:]
                if os.waitpid(child,os.WNOHANG)[0]:return
        finally:
            selector.close();os.close(incoming);os.close(master)
            try:os.killpg(child,signal.SIGKILL)
            except ProcessLookupError:pass


if __name__=='__main__':main()
