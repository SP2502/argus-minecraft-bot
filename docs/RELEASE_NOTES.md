# Argus Release Notes — Version 1.0.0 (Production Release)

Argus 1.0.0 represents the culmination of 12 developmental phases into a cohesive, self-contained, enterprise-grade autonomous Minecraft bot.

## Key Highlights

- **Unified Command Gateway**: Chat, Web Dashboard, and REST API commands pass through an identical pipeline with 5-tier RBAC, NLP intent matching, typo correction, and 2-phase critical confirmation.
- **Priority Preemption & Single-Lock Coordinator**: Resource locks for movement, inventory, and crafting prevent race conditions, while high-priority threat reactions preempt background work and resume from checkpoints.
- **Adaptive Ticks**: Autonomous loop scales evaluation frequency dynamically: Combat at 50ms (20 TPS), Active tasks at 100ms (10 TPS), Idle at 500ms (2 TPS), and Dashboard mode at 1000ms (1 TPS).
- **Core Safety Invariants**:
  - `ShadowPace` anchored as immutable Tier-4 Owner.
  - Slot-6 hotbar water bucket verified prior to hazardous deep mining.
  - Minimum 16-seed reserve strictly preserved during agricultural deposit loops.
  - Checkpoint emitted every 50 blocks during building construction.
  - Automatic emergency retreat triggered whenever health falls below 3 hearts (<6 hp).
  - Clean graceful shutdown on SIGINT/SIGTERM with state snapshot persistence.
- **Real-Time WebGL Dashboard**: 3D spatial terrain visualization, vitals gauges, activity timelines, task control panels, and live event streaming.
- **100% Free Open-Source Release**: Free from proprietary locks, hardcoded secrets, or personal paths. Ready for GitHub public release under the permissive MIT license.
