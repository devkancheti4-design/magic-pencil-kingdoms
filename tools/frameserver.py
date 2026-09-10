#!/usr/bin/env python3
"""Tiny local upload server used to record the ad: the game POSTs rendered frames here."""
import http.server, os, sys, urllib.parse
OUT = sys.argv[1] if len(sys.argv) > 1 else 'frames'
os.makedirs(OUT, exist_ok=True)
class H(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*'); self.send_header('Access-Control-Allow-Headers', '*'); self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()
    def do_POST(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        name = os.path.basename(q.get('name', ['frame'])[0])
        n = int(self.headers.get('Content-Length', 0)); data = self.rfile.read(n)
        with open(os.path.join(OUT, name), 'wb') as f: f.write(data)
        self.send_response(200); self._cors(); self.end_headers(); self.wfile.write(b'ok')
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', 8766), H).serve_forever()
