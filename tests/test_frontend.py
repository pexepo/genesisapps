import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class FrontendRegressionTests(unittest.TestCase):
    def test_invalid_fields_stay_visible_during_error_animation(self):
        css = (ROOT / "web/assets/styles.css").read_text(encoding="utf-8")
        rule = re.search(r"\.field\.invalid\s*\{([^}]+)\}", css)

        self.assertIsNotNone(rule)
        self.assertIn("opacity: 1", rule.group(1))

    def test_assets_are_versioned_to_avoid_stale_validation_code(self):
        html = (ROOT / "web/index.html").read_text(encoding="utf-8")

        self.assertRegex(html, r'/assets/styles\.css\?v=\d+')
        self.assertRegex(html, r'/assets/app\.js\?v=\d+')


if __name__ == "__main__":
    unittest.main()
