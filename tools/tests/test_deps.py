import unittest

from zest_tools import deps


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


if __name__ == "__main__":
    unittest.main()
