# Argus Testing Architecture & Verification

Argus utilizes Node.js built-in native test runner (`node:test` and `node:assert`), providing high execution speed, zero third-party testing bloat, and standard TAP output.

## Running Tests

```bash
# Run the complete test suite
npm test

# Run a specific test suite
node --test test/final-invariants.test.js
node --test test/unified-gateway.test.js
```

## Test Suite Inventory

1. `test/action-queue.test.js` - Priority action dispatching, cancellation tokens, timeout guards.
2. `test/ambient-command.test.js` - Gateway parsing and planning for ambient controls.
3. `test/ambient-service.test.js` - Bed sleeping, day/night sensing, auto-eat hunger recovery.
4. `test/build-skill.test.js` - Autonomous structural assembly, scaffolding, and safety preemption.
5. `test/building-command.test.js` - NLP building parameter extraction.
6. `test/building-policies.test.js` - Layer sorting, materials aggregation, obstacle filtering.
7. `test/chop-tree-skill.test.js` - Tree felling, replanting, leaves clearance.
8. `test/combat-command.test.js` - Guard, hunt, patrol command routing.
9. `test/combat-helper.test.js` - Threat scoring, enchantments, weapon scoring, ally whitelist.
10. `test/combat-policies.test.js` - Tactical decision trees (kiting creepers, shield blocking).
11. `test/combat-skill.test.js` - Target engagement, low health retreat.
12. `test/command-planner.test.js` - Sequential compound plans and parameter defaults.
13. `test/confirmation-manager.test.js` - Critical confirmation flows and timeout auto-rejection.
14. `test/coordinate-parser.test.js` - Absolute (X Y Z), 2D (X Z), and relative (~ ~ ~) parsing.
15. `test/craft-skill.test.js` - Workstation crafting, auto-crafting missing prerequisites.
16. `test/crafting-command.test.js` - NLP crafting intent mapping.
17. `test/crafting-service.test.js` - Multi-tier dependency tree resolution.
18. `test/final-invariants.test.js` - Immutable owner, 5-tier RBAC, rate limits, 16-seed reserve, slot-6 water bucket, adaptive ticks, lock timeouts, state checksum recovery, 50-block checkpoints.
19. `test/forestry-policies.test.js` - Protected base buffer, dimension constraints.
20. `test/logistics-command.test.js` - Warehouse sort and kit restock parsing.
21. `test/logistics-service.test.js` - Chest indexing, item spatial search, categorized inventory sorting.
22. `test/logistics-skill.test.js` - End-to-end warehouse restocking and chest categorization.
23. `test/quantity-parser.test.js` - Numeric, written number, and stack math ("2 stacks and a half").
24. `test/schematics.test.js` - Procedural generation of shelters, walls, staircases, boxes.
25. `test/spell-corrector.test.js` - Levenshtein distance typo auto-correction.
26. `test/tree-analyzer.test.js` - Bounded BFS cluster discovery, natural tree vs artificial structure.
27. `test/unified-gateway.test.js` - End-to-end gateway validation, disambiguation, authorization.
28. `test/woodcutting-command.test.js` - NLP woodcutting command extraction.

**Current Test Status**: 60 / 60 Suites & Subtests Passing (100% Pass Rate).
