# Security Policy

## Reporting a vulnerability

Report privately through GitHub's [Security Advisories](https://github.com/HibikiHata/vault-arcade/security/advisories/new).
Please do not open a public issue for a security problem.

You will get an acknowledgment within 7 days.

After triage I will confirm or decline the report, develop a fix privately,
and publish a security advisory crediting you (unless you prefer otherwise)
once a fixed release is out. This is a solo-maintained project; complex fixes
may take a few weeks.

## Supported versions

Only the latest release is supported. Fixes are not backported.

## What this project touches

Knowing the boundaries is usually enough to judge whether something is a
security problem here.

- **Network.** None. The plugin makes no network requests, loads no remote
  code, and sends no telemetry.
- **Vault access.** The plugin reads and writes only its own `data.json`
  (settings and high scores) through Obsidian's plugin data API. No note is
  read or modified, and nothing outside the vault is touched. An in-progress
  game is kept in the workspace layout through Obsidian's view-state
  mechanism (written by Obsidian, not by the plugin).
- **Dependencies.** `main.js` is bundled from this repository's source and has
  no runtime dependency beyond the Obsidian API. The development dependencies
  (esbuild, TypeScript, ESLint, Vitest) do not ship.
- **Input.** Saved state restored from `data.json` and from the workspace
  layout is validated before use; malformed data falls back to defaults.
- **Third-party Actions.** Every `uses:` in this repository is pinned to a full
  commit SHA.

## Out of scope

- Vulnerabilities in Obsidian itself or in the GitHub Actions this repository
  pins — report those upstream.
- A development dependency with a known CVE, unless the vulnerable code is
  actually reachable from the shipped `main.js`.
- Anything that requires write access to this repository or a compromised
  workflow token.

If you used AI tools to find or write up the issue, say so, and verify the
proof of concept reproduces before reporting. Unverified machine-generated
reports are closed without response.
