# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of Argus seriously. If you discover a security vulnerability, please do NOT create a public GitHub issue.

Instead, please send an email to `security@argus-bot.org` (or report via private GitHub Security Advisory).

Include:
- Type of issue (e.g. command injection, authorization bypass, rate-limit evasion)
- Steps to reproduce
- Potential impact

We will review reports within 48 hours and work with you to release a patch promptly.

## Security Architecture & Invariants

1. **Immutable Owner**:
   The owner (`ShadowPace` by default, or configured via `OWNER_USERNAME`) cannot be revoked, demoted, or blocked at runtime. All administrative overrides are anchored to the owner tier.
2. **Centralized 5-Tier RBAC**:
   - `OWNER` (Tier 4): Absolute system and administrative control.
   - `ADMIN` (Tier 3): Task management, configuration, inventory, and location registration.
   - `TRUSTED` (Tier 2): Safe automated tasks (mining, farming, building, emergency stop, recall).
   - `GUEST` (Tier 1): Read-only status checks, telemetry queries, and benign greetings.
   - `BLOCKED` (Tier 0): No commands allowed.
3. **Brute-Force Lockout**:
   3 failed authorization attempts within a 5-minute rolling window results in an automatic 10-minute temporary account lockout.
4. **Command Rate Limiting**:
   Non-owner users are strictly rate-limited to 10 commands per minute.
5. **No Dangerous Execution**:
   Command input is strictly tokenized, parsed via static NLP intents, schema-validated, and planned into structured task objects. Raw arbitrary eval or bash execution is impossible.
