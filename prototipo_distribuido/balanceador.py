import socket
import threading


class Balanceador:
    """Proxy round-robin (simula el reverse-proxy Nginx de Klubb).

    Acepta clientes y reenvia cada conexion a la siguiente replica del API,
    haciendo un puente bidireccional con dos hilos por conexion.
    """

    def __init__(self, port, nodes):
        self.port = port
        self.nodes = list(nodes)
        self.idx = 0
        self.lock = threading.Lock()
        self.total = 0
        self.server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.server.bind(("127.0.0.1", port))
        self.server.listen(128)
        self.running = True

    def _next(self):
        with self.lock:
            node = self.nodes[self.idx % len(self.nodes)]
            self.idx += 1
            self.total += 1
            return node

    def start(self):
        while self.running:
            try:
                client_conn, _ = self.server.accept()
            except OSError:
                break
            node = self._next()
            threading.Thread(target=self._proxy, args=(client_conn, node), daemon=True).start()

    def _proxy(self, client_conn, node):
        try:
            node_conn = socket.create_connection(node)
        except Exception:
            try:
                client_conn.close()
            except Exception:
                pass
            return
        threading.Thread(target=self._pipe, args=(client_conn, node_conn), daemon=True).start()
        threading.Thread(target=self._pipe, args=(node_conn, client_conn), daemon=True).start()

    def _pipe(self, src, dst):
        try:
            while True:
                data = src.recv(65536)
                if not data:
                    break
                dst.sendall(data)
        except Exception:
            pass
        finally:
            for s in (src, dst):
                try:
                    s.close()
                except Exception:
                    pass

    def stop(self):
        self.running = False
        try:
            self.server.close()
        except Exception:
            pass
