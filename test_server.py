import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import urlopen

from server import Handler


class StaticServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.origin = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def test_healthcheck_is_available(self):
        with urlopen(self.origin + "/healthz") as response:
            self.assertEqual(response.status, 200)
            self.assertEqual(response.read(), b"ok")
            self.assertEqual(response.headers["Content-Type"], "text/plain; charset=utf-8")

    def test_game_and_modules_are_served_with_correct_types(self):
        for path, expected_type, content in (
            ("/", "text/html; charset=utf-8", "星际温室".encode()),
            ("/styles.css", "text/css; charset=utf-8", b".game-grid"),
            ("/game.mjs", "text/javascript; charset=utf-8", b"export const GENERATORS"),
        ):
            with self.subTest(path=path), urlopen(self.origin + path) as response:
                self.assertEqual(response.status, 200)
                self.assertEqual(response.headers["Content-Type"], expected_type)
                self.assertIn(content, response.read())

    def test_repository_files_are_not_public(self):
        for path in ("/README.md", "/test_server.py", "/.git/config", "/missing"):
            with self.subTest(path=path), self.assertRaises(HTTPError) as error:
                urlopen(self.origin + path)
            self.assertEqual(error.exception.code, 404)


if __name__ == "__main__":
    unittest.main()
