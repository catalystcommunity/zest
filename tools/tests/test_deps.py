import tempfile
import unittest
from pathlib import Path

from zest_tools import deps
from zest_tools.commands import ToolFailed


def version(text):
    return tuple(int(part) for part in text.split("."))


class PinTests(unittest.TestCase):
    def test_the_pinned_npm_has_npm_stage(self):
        self.assertGreaterEqual(version(deps.NODE_NPM_VERSION), version(deps.MINIMUM_STAGE_NPM))

    def test_each_platform_has_a_digest(self):
        self.assertEqual(set(deps.NODE_SHA256), {"linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64"})
        self.assertEqual(set(deps.SEMVER_TAGS_SHA256), {"linux-amd64", "linux-arm64", "darwin-amd64", "darwin-arm64"})
        for digest in [*deps.NODE_SHA256.values(), *deps.SEMVER_TAGS_SHA256.values()]:
            self.assertRegex(digest, r"^[0-9a-f]{64}$")


class BrowserTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.browsers = Path(temporary.name)
        self.directory = self.browsers / "chromium_headless_shell-1" / "chrome-headless-shell-linux64"
        self.directory.mkdir(parents=True)

    def test_finds_the_executable_and_not_the_license_beside_it(self):
        (self.directory / "LICENSE.headless_shell").write_text("text")
        browser = self.directory / "chrome-headless-shell"
        browser.write_text("#!/bin/sh\n")
        browser.chmod(0o755)
        self.assertEqual(deps.find_browser(self.browsers), browser)

    def test_finds_nothing_when_only_the_license_is_there(self):
        (self.directory / "LICENSE.headless_shell").write_text("text")
        self.assertIsNone(deps.find_browser(self.browsers))

    def test_a_file_that_ldd_cannot_read_is_a_failure_and_not_success(self):
        text = self.directory / "LICENSE.headless_shell"
        text.write_text("text")
        with self.assertRaisesRegex(ToolFailed, "ldd cannot read"):
            deps._missing_libraries(text, {})


if __name__ == "__main__":
    unittest.main()
