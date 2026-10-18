"""Guards for #319: RabbitMQ consumer must survive broker errors and use env credentials."""
import ast
import unittest
from pathlib import Path

SOURCE = Path(__file__).with_name("event_router.py").read_text(encoding="utf-8")


class EventRouterSourceGuards(unittest.TestCase):
    def setUp(self):
        tree = ast.parse(SOURCE)
        self.source = SOURCE

    def test_no_hardcoded_guest_credentials(self):
        self.assertNotIn('PlainCredentials("guest"', self.source, "must not hardcode guest/guest")
        self.assertNotIn("PlainCredentials('guest'", self.source, "must not hardcode guest/guest")

    def test_no_string_split_host_parsing(self):
        self.assertNotIn('.split("@")[1].split(":")[0]', self.source, "host must come from a URL parser")

    def test_uses_urlparse(self):
        self.assertIn("urlparse(", self.source, "must parse the broker URL properly")
        self.assertIn("parsed.port", self.source, "must honor the configured port")

    def test_env_credentials_and_hard_fail(self):
        self.assertIn("RABBITMQ_USER", self.source)
        self.assertIn("RABBITMQ_PASSWORD", self.source)
        self.assertIn("Hard-failing rather than falling back to guest/guest", self.source)

    def test_supervised_reconnect_loop(self):
        self.assertIn("while True:", self.source, "consumer must run in a supervised loop")
        self.assertIn("_CONSUMER_BACKOFF_CAP_SEC", self.source, "backoff must be capped")
        self.assertIn("time.sleep(delay)", self.source, "must back off between reconnect attempts")

    def test_manual_ack_and_poison_handling(self):
        self.assertIn("auto_ack=False", self.source, "must use manual ack so failures are not lost")
        self.assertIn("basic_ack", self.source)
        self.assertIn("basic_nack", self.source)
        self.assertIn("requeue=not redelivered", self.source, "poison messages must not loop forever")

    def test_broker_url_parsing_contract(self):
        ns = {}
        # Execute only parse_broker in isolation to avoid importing the module
        # (which pulls in sqlalchemy). Extract the function via AST.
        tree = ast.parse(SOURCE)
        fn = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "parse_broker")
        mod = ast.Module(body=[ast.ImportFrom(module="urllib.parse", names=[
            ast.alias(name="unquote"), ast.alias(name="urlparse")], level=0), fn], type_ignores=[])
        exec(compile(ast.fix_missing_locations(mod), "<parse_broker>", "exec"), ns)
        parse_broker = ns["parse_broker"]

        default = parse_broker("amqp://user:pass@rabbitmq:5672/")
        self.assertEqual(default["host"], "rabbitmq")
        self.assertEqual(default["port"], 5672)
        self.assertEqual(default["username"], "user")

        at_in_password = parse_broker("amqp://user:p@ss@host:5673/")
        self.assertEqual(at_in_password["host"], "host")
        self.assertEqual(at_in_password["port"], 5673)
        self.assertEqual(at_in_password["password"], "p@ss")

        no_user = parse_broker("amqp://rabbitmq/")
        self.assertIsNone(no_user["username"])
        self.assertEqual(no_user["port"], 5672)

        with self.assertRaises(ValueError):
            parse_broker("rabbitmq")
        with self.assertRaises(ValueError):
            parse_broker("ftp://rabbitmq:5672/")


if __name__ == "__main__":
    unittest.main()
