import pytest
from app.services.dc_runtime import split_java_files, detect_topology


def test_split_java_files_by_file_comment():
    source = """
// File: EchoServer.java
import java.net.*;
import java.io.*;

public class EchoServer {
    public static void main(String[] args) {
        System.out.println("Server started");
    }
}

// File: EchoClient.java
import java.net.*;
import java.io.*;

public class EchoClient {
    public static void main(String[] args) {
        System.out.println("Client started");
    }
}
"""
    files = split_java_files(source)
    assert len(files) == 2
    assert "EchoServer.java" in files
    assert "EchoClient.java" in files
    assert "class EchoServer" in files["EchoServer.java"]
    assert "class EchoClient" in files["EchoClient.java"]


def test_split_java_files_by_markdown_blocks():
    source = """
Here is the server:
```java
// File: Server.java
public class Server {
    public static void main(String[] args) {}
}
```

Here is the client:
```java
// File: Client.java
public class Client {
    public static void main(String[] args) {}
}
```
"""
    files = split_java_files(source)
    assert len(files) == 2
    assert "Server.java" in files
    assert "Client.java" in files


def test_split_java_single_file_fallback():
    source = """
public class SingleDriverSimulation {
    public static void main(String[] args) {
        System.out.println("Simulating distributed nodes");
    }
}
"""
    files = split_java_files(source)
    assert len(files) == 1
    assert "SingleDriverSimulation.java" in files


def test_detect_topology():
    files = {
        "EchoServer.java": """
        import java.net.ServerSocket;
        public class EchoServer {
            public static void main(String[] args) {
                ServerSocket ss = new ServerSocket(5000);
            }
        }
        """,
        "EchoClient.java": """
        import java.net.Socket;
        public class EchoClient {
            public static void main(String[] args) {
                Socket s = new Socket("localhost", 5000);
            }
        }
        """,
    }
    server_class, client_class, mains = detect_topology(files)
    assert server_class == "EchoServer"
    assert client_class == "EchoClient"
    assert "EchoServer" in mains
    assert "EchoClient" in mains


def test_detect_topology_single_driver():
    files = {
        "BullyElection.java": """
        public class BullyElection {
            public static void main(String[] args) {
                System.out.println("Bully election simulator");
            }
        }
        """
    }
    server_class, client_class, mains = detect_topology(files)
    assert mains == ["BullyElection"]


def test_detect_topology_nested_static_server_client():
    files = {
        "CalculatorRMI.java": """
        public class CalculatorRMI {
            public static class CalculatorServer {
                public static void main(String[] args) {
                    System.out.println("Server ready");
                }
            }
            public static class CalculatorClient {
                public static void main(String[] args) {
                    System.out.println("Client connected");
                }
            }
        }
        """
    }
    server_class, client_class, mains = detect_topology(files)
    assert server_class == "CalculatorRMI$CalculatorServer"
    assert client_class == "CalculatorRMI$CalculatorClient"
    assert mains == ["CalculatorRMI$CalculatorServer", "CalculatorRMI$CalculatorClient"]


def test_detect_topology_single_file_server_and_client():
    files = {
        "Server.java": """
        import java.net.*;
        public class Server {
            public static void main(String[] args) throws Exception {
                new ServerSocket(5555);
            }
        }
        class Client {
            public static void main(String[] args) throws Exception {
                new Socket("127.0.0.1", 5555);
            }
        }
        """
    }
    server_class, client_class, mains = detect_topology(files)
    assert server_class == "Server"
    assert client_class == "Client"
    assert mains == ["Server", "Client"]


@pytest.mark.asyncio
async def test_run_server_client_rejects_server_exit_before_client(tmp_path, monkeypatch):
    from unittest.mock import AsyncMock
    from app.services import dc_runtime

    class FakeStream:
        def __init__(self, data: bytes):
            self._data = data
            self._pos = 0
        async def read(self, n=-1):
            if self._pos >= len(self._data):
                return b""
            chunk = self._data[self._pos:self._pos + (len(self._data) if n < 0 else n)]
            self._pos += len(chunk)
            return chunk

    class FakeProc:
        def __init__(self):
            self.returncode = 0
            self.stdout = FakeStream(b"Server listening on port 61080\nDemonstration complete\n")
            self.stderr = FakeStream(b"")
        def kill(self):
            pass
        async def wait(self):
            return 0

    process = FakeProc()
    process.stdin = type("Input", (), {"close": lambda self: None})()
    monkeypatch.setattr(dc_runtime, "start_process", AsyncMock(return_value=process))
    monkeypatch.setattr(dc_runtime.asyncio, "sleep", AsyncMock())
    res = await dc_runtime._run_server_client(tmp_path, "LabServer", "LabClient", None, 20.0)
    assert res.success is False
    assert res.exit_code == 0
    assert "Demonstration complete" in res.error



