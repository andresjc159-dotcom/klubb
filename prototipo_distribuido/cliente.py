import socket
import threading
import time

from common import json_lines, send_json


class Cliente:
    """Cliente (staff o PWA) que se conecta a un nodo o al balanceador."""

    def __init__(self, nombre, host="127.0.0.1", port=18080):
        self.nombre = nombre
        self.sock = socket.create_connection((host, port))
        self.received = []
        self.lock = threading.Lock()
        threading.Thread(target=self._loop, daemon=True).start()

    def join(self, ch):
        send_json(self.sock, {"t": "join", "ch": ch})

    def publish(self, ch, ev, d=None):
        send_json(self.sock, {"t": "publish", "ch": ch, "ev": ev, "d": d})

    def _loop(self):
        for msg in json_lines(self.sock):
            if msg.get("t") == "event":
                with self.lock:
                    self.received.append((msg, time.time()))

    def count(self):
        with self.lock:
            return len(self.received)

    def close(self):
        try:
            self.sock.close()
        except Exception:
            pass
