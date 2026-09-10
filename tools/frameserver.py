#!/usr/bin/env python3
"""Tiny local upload server used to record the ad: the game POSTs rendered frames here."""
import http.server, os, sys, urllib.parse, json, base64
OUT = sys.argv[1] if len(sys.argv) > 1 else 'frames'
os.makedirs(OUT, exist_ok=True)
class H(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*'); self.send_header('Access-Control-Allow-Headers', '*'); self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()
    def do_POST(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        n = int(self.headers.get('Content-Length', 0)); data = self.rfile.read(n)
        if u.path.startswith('/batch'):
            for item in json.loads(data):
                with open(os.path.join(OUT, os.path.basename(item['name'])), 'wb') as f: f.write(base64.b64decode(item['b64']))
        else:
            name = os.path.basename(q.get('name', ['frame'])[0])
            with open(os.path.join(OUT, name), 'wb') as f: f.write(data)
        self.send_response(200); self._cors(); self.end_headers(); self.wfile.write(b'ok')
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', 8766), H).serve_forever()
