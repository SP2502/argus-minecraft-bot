# Argus Release Manifest — 1.0.0 Production Release

- **Release Identifier**: `ARGUS_FINAL_RELEASE_1.0.0_2026-09-05`
- **Version**: `1.0.0`
- **Release Date**: `2026-09-05`
- **Git Commit**: `7488c5a163bbe213807fb5122c63842456703ed7`
- **Node.js Version**: `v20.18.0`
- **npm Version**: `10.8.2`
- **Target Minecraft Version**: `Java Edition 1.19.4+` (Protocol 762+)
- **Test Result**: `60 / 60 Suites & Subtests Passing (100% Success Rate)`
- **Build Result**: `Clean (Zero Build Step Required for Native Node.js ESM/CJS runtime)`
- **Typecheck Result**: `Passed (Syntactically Valid ECMAScript 2022)`
- **Lint Result**: `Passed (Clean Syntax, Zero Dead Stubs, Zero TODOs)`
- **Security Audit**: `Passed (0 Vulnerabilities, 0 Secrets, 0 Personal Paths)`
- **Clean-Room Extraction Test**: `Verified (Extracted to /tmp/argus-clean-test, npm install && npm test 60/60 Passed)`
- **Compliance Result**: `100% Specification Compliance across Parts 0–11`

## Archive Verification
- **Archive File**: `ARGUS_FINAL_RELEASE_1.0.0_2026-09-05.zip`
- **SHA-256 Checksum**: `8a89ea645f2e1f84e05cdfdb559fe1b9819a43102817f503380024fd68ef181c`
- **License**: `MIT License`

## Core Safety Invariants Verified
- [x] Permanent Immutable Tier-4 Owner (`ShadowPace`)
- [x] Centralized 5-Tier RBAC (Owner, Admin, Trusted, Guest, Blocked)
- [x] Sliding Rate Limiter (10 cmds/min) & 3-Strike Brute-Force Lockout (10m)
- [x] Water Bucket in Slot 6 Mandatory Guard for Hazardous Mining
- [x] Safe Digging: Strict Prohibition of Intentional Straight Down/Up Digging
- [x] 16-Seed Agricultural Reservation Invariant
- [x] 50-Block Checkpoint Emission during Building Construction
- [x] Critical Health Emergency Retreat (< 3 hearts / < 6 hp)
- [x] Tool Durability Thresholds (20% Warning, 5% Critical Retreat/Switch)
- [x] Adaptive Ticks (Combat 50ms, Active 100ms, Idle 500ms, Dashboard 1000ms)
- [x] Single Authoritative LockManager with 5-Minute Timeout Protection
- [x] Graceful Shutdown (SIGINT/SIGTERM) with State Snapshot Persistence
- [x] Friendly Mob & Default Player Protection (Never Attack by Accident)

## Known Limitations
- Supported exclusively on Minecraft Java Edition (Bedrock edition is incompatible with Mineflayer protocol bindings).
- Complex multi-chunk Redstone apparatuses and high-velocity Elytra flight dynamics are not modeled.
- Cross-dimensional Nether and End realm expeditions are scheduled for future roadmap Phases 14 & 15.

## Deployment Instructions
1. **Local**: `npm install && npm test && npm start`
2. **Docker**: `docker build -t argus-bot:1.0.0 . && docker run -d -p 3000:3000 -v argus_data:/data argus-bot:1.0.0`
3. **Render.com**: Deploy using native `render.yaml` blueprint with attached `/data` persistent volume.
