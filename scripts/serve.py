#!/usr/bin/env python3
"""Serve only the built app, with no access to source or parent directories."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import socket
import sys

ROOT = Path(__file__).resolve().parent.parent / 'dist'
PORT = 5188
class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
        if self.path.split('?')[0] in ('/', '/index.html', '/sw.js'):
            self.send_header('Cache-Control', 'no-cache')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'self'")
        super().end_headers()
    def translate_path(self, path):
        translated = Path(super().translate_path(path)).resolve()
        if not translated.is_relative_to(ROOT.resolve()):
            return str(ROOT / '__blocked__')
        return str(translated)
    def list_directory(self,path):
        self.send_error(403, 'Kein Verzeichniszugriff')

if not (ROOT / 'index.html').exists():
    sys.exit('App bitte zuerst mit npm run build erstellen.')
try:
    sock=socket.socket(socket.AF_INET,socket.SOCK_DGRAM)
    sock.connect(('192.0.2.1',80))
    address=sock.getsockname()[0]
    sock.close()
except OSError:
    try:
        address=socket.gethostbyname(socket.gethostname())
    except OSError:
        address='127.0.0.1'
print(f'\nfolio. ist bereit.\nMac: http://localhost:{PORT}\niPad im gleichen WLAN: http://{address}:{PORT}\nZum Beenden: Ctrl+C\n',flush=True)
try:
    ThreadingHTTPServer(('0.0.0.0',PORT),AppHandler).serve_forever()
except KeyboardInterrupt:
    pass
