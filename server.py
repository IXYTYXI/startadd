"""Serve the game assets and the health check for Awesome Deploy."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os


ROOT = Path(__file__).resolve().parent
ASSETS = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/index.html": ("index.html", "text/html; charset=utf-8"),
    "/styles.css": ("styles.css", "text/css; charset=utf-8"),
    "/app.mjs": ("app.mjs", "text/javascript; charset=utf-8"),
    "/game.mjs": ("game.mjs", "text/javascript; charset=utf-8"),
}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self._respond(include_body=True)

    def do_HEAD(self):
        self._respond(include_body=False)

    def _respond(self, include_body):
        path = self.path.split("?", 1)[0]
        if path == "/healthz":
            body = b"ok"
            content_type = "text/plain; charset=utf-8"
        elif path in ASSETS:
            filename, content_type = ASSETS[path]
            try:
                body = (ROOT / filename).read_bytes()
            except OSError:
                self.send_error(500, "Asset unavailable")
                return
        else:
            self.send_error(404, "Not found")
            return

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        if include_body:
            self.wfile.write(body)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"Serving Stellar Greenhouse on port {port}", flush=True)
    server.serve_forever()
