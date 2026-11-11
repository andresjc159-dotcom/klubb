import socket
import threading

from common import json_lines, send_json


class Bus:
    """Broker pub/sub central (simula el adaptador Redis de Socket.IO).

    Mantiene, por canal ("tenant:X", "mesa:Y", "user:Z"), el conjunto de nodos
    suscritos. Un hilo por conexion de nodo lee los mensajes y reenvia cada
    publicacion a todos los demas nodos suscritos (excluyendo al origen).
    """

    def __init__(self, host="127.0.0.1", port=16379):
        self.host = host
        self.port = port
        self.channels = {}
        self.lock = threading.Lock()
        self.total_forwarded = 0
        self.server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.server.bind((host, port))
        self.server.listen(128)
        self.running = True

    def start(self):
        while self.running:
            try:
                conn, addr = self.server.accept()
            except OSError:
                break
            threading.Thread(target=self._handle, args=(conn, addr), daemon=True).start()

    def _handle(self, conn, addr):
        try:
            for msg in json_lines(conn):
                t = msg.get("t")
                if t == "subscribe":
                    self._subscribe(conn, msg["ch"])
                elif t == "publish":
                    self._publish(msg, origin=conn)
        except Exception:
            pass
        finally:
            self._drop(conn)
            try:
                conn.close()
            except Exception:
                pass

    def _subscribe(self, conn, ch):
        with self.lock:
            self.channels.setdefault(ch, set()).add(conn)

    def _drop(self, conn):
        with self.lock:
            for subs in self.channels.values():
                subs.discard(conn)

    def _publish(self, msg, origin):
        ch = msg["ch"]
        with self.lock:
            targets = [c for c in self.channels.get(ch, ()) if c is not origin]
        for c in targets:
            try:
                send_json(
                    c,
                    {
                        "t": "publish",
                        "ch": ch,
                        "ev": msg.get("ev"),
                        "d": msg.get("d"),
                        "origin": msg.get("nid"),
                    },
                )
                with self.lock:
                    self.total_forwarded += 1
            except Exception:
                self._drop(c)

    def stats(self):
        with self.lock:
            return {
                "channels": {k: len(v) for k, v in self.channels.items()},
                "forwarded": self.total_forwarded,
            }

    def stop(self):
        self.running = False
        try:
            self.server.close()
        except Exception:
            pass
