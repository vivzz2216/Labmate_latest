import pytest
from pathlib import Path
from backend.app.services.dc_runtime import split_java_files, detect_topology


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

