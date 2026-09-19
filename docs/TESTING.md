# Argus Testing Architecture & Verification

Argus utilizes Node.js built-in native test runner (`node:test` and `node:assert`), providing high execution speed, zero third-party testing bloat, and standard TAP output.

## Running Tests

```bash
# Run the complete test suite (recursively discovers all 34 suites across test/)
npm test

# Run a specific test suite
node --test test/invariants/final-invariants.test.js
node --test test/modules/commands/unified-gateway.test.js
node --test test/modules/combat/combat-skill.test.js
```

## Test Suite Inventory by Module Boundary

### Core & Invariants
1. `test/core/auth-network.test.js` - Dynamic owner configuration, permission immutability, offline database credentials.
2. `test/invariants/final-invariants.test.js` - Immutable owner, 5-tier RBAC, rate limits, 16-seed reserve, slot-6 water bucket, adaptive ticks, lock timeouts, state checksum recovery, 50-block checkpoints.

### Domain Modules
3. `test/modules/behavior/ambient-command.test.js` - Gateway parsing and planning for ambient controls.
4. `test/modules/behavior/ambient-service.test.js` - Bed sleeping, day/night sensing, auto-eat hunger recovery.
5. `test/modules/building/build-skill.test.js` - Autonomous structural assembly, scaffolding, and safety preemption.
6. `test/modules/building/building-command.test.js` - NLP building parameter extraction.
7. `test/modules/building/building-policies.test.js` - Layer sorting, materials aggregation, obstacle filtering.
8. `test/modules/building/schematics.test.js` - Procedural generation of shelters, walls, staircases, boxes.
9. `test/modules/combat/combat-command.test.js` - Guard, hunt, patrol command routing.
10. `test/modules/combat/combat-defense-humanoid.test.js` - Interaction smoothing, humanoid behaviors, tactical evasion.
11. `test/modules/combat/combat-helper.test.js` - Threat scoring, enchantments, weapon scoring, ally whitelist.
12. `test/modules/combat/combat-policies.test.js` - Tactical decision trees (kiting creepers, shield blocking).
13. `test/modules/combat/combat-skill.test.js` - Target engagement, low health retreat.
14. `test/modules/combat/mob-tactics.test.js` - Tactic resolution across all Minecraft hostile mob archetypes.
15. `test/modules/commands/command-planner.test.js` - Sequential compound plans and parameter defaults.
16. `test/modules/commands/confirmation-manager.test.js` - Critical confirmation flows and timeout auto-rejection.
17. `test/modules/commands/unified-gateway.test.js` - End-to-end gateway validation, disambiguation, authorization.
18. `test/modules/dashboard/session-auth.test.js` - Signed dashboard cookie sessions, token tampering rejection.
19. `test/modules/forestry/chop-tree-skill.test.js` - Tree felling, replanting, leaves clearance.
20. `test/modules/forestry/forestry-policies.test.js` - Protected base buffer, dimension constraints.
21. `test/modules/forestry/tree-analyzer.test.js` - Bounded BFS cluster discovery, natural tree vs artificial structure.
22. `test/modules/forestry/woodcutting-command.test.js` - NLP woodcutting command extraction.
23. `test/modules/inventory/craft-skill.test.js` - Workstation crafting, auto-crafting missing prerequisites.
24. `test/modules/inventory/crafting-command.test.js` - NLP crafting intent mapping.
25. `test/modules/inventory/crafting-service.test.js` - Multi-tier dependency tree resolution.
26. `test/modules/logistics/logistics-command.test.js` - Warehouse sort and kit restock parsing.
27. `test/modules/logistics/logistics-service.test.js` - Chest indexing, item spatial search, categorized inventory sorting.
28. `test/modules/logistics/logistics-skill.test.js` - End-to-end warehouse restocking and chest categorization.
29. `test/modules/nlp/coordinate-parser.test.js` - Absolute (X Y Z), 2D (X Z), and relative (~ ~ ~) parsing.
30. `test/modules/nlp/quantity-parser.test.js` - Numeric, written number, and stack math ("2 stacks and a half").
31. `test/modules/nlp/spell-corrector.test.js` - Levenshtein distance typo auto-correction.
32. `test/modules/server-auth/server-auth.test.js` - Offline database management, password generation, server reset re-registration.

### Shared Infrastructure
33. `test/shared/action-queue.test.js` - Priority action dispatching, cancellation tokens, timeout guards.
34. `test/shared/advanced-logging-auth-detection.test.js` - Diagnostic logging cards, connection troubleshooting, auth prompt detection.

**Current Test Status**: 104 / 104 Tests Passing (100% Pass Rate across 34 suites).
