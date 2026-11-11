import json


def encode(msg):
    return (json.dumps(msg, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")


def send_json(sock, msg):
    sock.sendall(encode(msg))


def json_lines(sock):
    f = sock.makefile("r", encoding="utf-8")
    for line in f:
        line = line.strip()
        if line:
            yield json.loads(line)
