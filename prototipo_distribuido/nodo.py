import socket
import threading

from common import json_lines, send_json


class Nodo:
    """Replica del API (simula EventsGateway + adaptador Redis).

    Ejecuta tres tipos de hilo:
      * acceptor: acepta conexiones de clientes (via balanceador o directas).
      * un hilo por cliente: lee join/publish y despacha.
      * bus_reader: recibe publicaciones de otros nodos y entrega a sus clientes.
    """

    def __init__(self, nid, bus_host="127.0.0.1", bus_port=16379, host="127.0.0.1", port=13001):
        self.nid = nid
        self.host = host
        self.port = port
        self.bus_host = bus_host
        self.bus_port = bus_port
        self.bus_conn = None
        self.server = None
        self.local_channels = {}
        self.client_conns = set()
        self.lock = threading.Lock()
        self.delivered = 0
        self.bus_received = 0

    def start(self):
        self.bus_conn = socket.create_connection((self.bus_host, self.bus_port))
        self.server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.server.bind((self.host, self.port))
        self.server.listen(128)
        threading.Thread(target=self._bus_reader, daemon=True).start()
        threading.Thread(target=self._acceptor, daemon=True).start()

    def _bus_reader(self):
        for msg in json_lines(self.bus_conn):
            if msg.get("t") == "publish":
                with self.lock:
                    self.bus_received += 1
                self._deliver(msg["ch"], msg)

    def _acceptor(self):
        while True:
            try:
                conn, _ = self.server.accept()
            except OSError:
                break
            threading.Thread(target=self._handle_client, args=(conn,), daemon=True).start()

    def _handle_client(self, conn):
        with self.lock:
            self.client_conns.add(conn)
        try:
            for msg in json_lines(conn):
                t = msg.get("t")
                if t == "join":
                    ch = msg["ch"]
                    with self.lock:
                        self.local_channels.setdefault(ch, set()).add(conn)
                    send_json(self.bus_conn, {"t": "subscribe", "ch": ch, "nid": self.nid})
                elif t == "publish":
                    ch = msg["ch"]
                    self._deliver(
                        ch,
                        {"ch": ch, "ev": msg.get("ev"), "d": msg.get("d"), "origin": self.nid},
                    )
                    send_json(
                        self.bus_conn,
                        {"t": "publish", "ch": ch, "ev": msg.get("ev"), "d": msg.get("d"), "nid": self.nid},
                    )
        except Exception:
            pass
        finally:
            with self.lock:
                self.client_conns.discard(conn)
                for subs in self.local_channels.values():
                    subs.discard(conn)
            try:
                conn.close()
            except Exception:
                pass

    def _deliver(self, ch, msg):
        with self.lock:
            targets = list(self.local_channels.get(ch, ()))
        for c in targets:
            try:
                send_json(
                    c,
                    {
                        "t": "event",
                        "ch": ch,
                        "ev": msg.get("ev"),
                        "d": msg.get("d"),
                        "origin": msg.get("origin"),
                        "node": self.nid,
                    },
                )
                with self.lock:
                    self.delivered += 1
            except Exception:
                with self.lock:
                    self.local_channels.get(ch, set()).discard(c)

    def stats(self):
        with self.lock:
            return {
                "nid": self.nid,
                "delivered": self.delivered,
                "bus_received": self.bus_received,
                "local_channels": {k: len(v) for k, v in self.local_channels.items()},
            }

    def stop(self):
        try:
            self.server.close()
        except Exception:
            pass
        try:
            self.bus_conn.shutdown(socket.SHUT_RDWR)
        except Exception:
            pass
        try:
            self.bus_conn.close()
        except Exception:
            pass
        with self.lock:
            conns = list(self.client_conns)
        for c in conns:
            try:
                c.shutdown(socket.SHUT_RDWR)
            except Exception:
                pass
            try:
                c.close()
            except Exception:
                pass
