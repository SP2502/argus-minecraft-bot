const test = require('node:test');
const assert = require('node:assert');
const TreeAnalyzer = require('../skills/woodcutting/TreeAnalyzer');
const treeData = require('../skills/woodcutting/treeData');
const forestryConfig = require('../config/forestryConfig');

test('TreeAnalyzer - Family Identification and Analysis', () => {
  const analyzer = new TreeAnalyzer(null, treeData, forestryConfig);

  // 1. Family recognition
  assert.strictEqual(analyzer.getFamilyForLog('oak_log'), 'oak');
  assert.strictEqual(analyzer.getFamilyForLog('stripped_spruce_log'), 'spruce');
  assert.strictEqual(analyzer.getFamilyForLog('crimson_stem'), 'crimson');
  assert.strictEqual(analyzer.getFamilyForLog('warped_stem'), 'warped');
  assert.strictEqual(analyzer.getFamilyForLog('diamond_block'), null);
});

test('TreeAnalyzer - Natural Tree vs Artificial Structure Detection', () => {
  // Mock world with a natural 3-block oak tree
  const naturalBlocks = {
    '0,63,0': { name: 'grass_block', boundingBox: 'block' },
    '0,64,0': { name: 'oak_log', boundingBox: 'block' },
    '0,65,0': { name: 'oak_log', boundingBox: 'block' },
    '0,66,0': { name: 'oak_log', boundingBox: 'block' },
    '0,67,0': { name: 'oak_leaves', boundingBox: 'empty' },
    '1,66,0': { name: 'oak_leaves', boundingBox: 'empty' }
  };

  const mockBotNatural = {
    blockAt: (pos) => naturalBlocks[`${pos.x},${pos.y},${pos.z}`] || { name: 'air', boundingBox: 'empty' }
  };

  const analyzerNatural = new TreeAnalyzer(mockBotNatural, treeData, forestryConfig);
  const analysisNatural = analyzerNatural.analyzeTree({ x: 0, y: 64, z: 0 });

  assert.strictEqual(analysisNatural.family, 'oak');
  assert.strictEqual(analysisNatural.logPositions.length, 3);
  assert.strictEqual(analysisNatural.safe, true);
  assert.strictEqual(analysisNatural.naturalEvidence.isNatural, true);

  // Top-down cut order must sort from Y=66 down to Y=64
  const cutOrder = analyzerNatural.getSafeCutOrder(analysisNatural);
  assert.strictEqual(cutOrder[0].y, 66);
  assert.strictEqual(cutOrder[1].y, 65);
  assert.strictEqual(cutOrder[2].y, 64);

  // Mock world with an artificial pillar on stone with NO leaves
  const fakeBlocks = {
    '10,63,10': { name: 'stone', boundingBox: 'block' },
    '10,64,10': { name: 'oak_log', boundingBox: 'block' },
    '10,65,10': { name: 'oak_log', boundingBox: 'block' }
  };

  const mockBotFake = {
    blockAt: (pos) => fakeBlocks[`${pos.x},${pos.y},${pos.z}`] || { name: 'air', boundingBox: 'empty' }
  };

  const analyzerFake = new TreeAnalyzer(mockBotFake, treeData, forestryConfig);
  const analysisFake = analyzerFake.analyzeTree({ x: 10, y: 64, z: 10 });
  assert.strictEqual(analysisFake.naturalEvidence.isNatural, false);
});

test('TreeAnalyzer - Bounded BFS Log Cluster Limit', () => {
  // Mock an infinite log grid
  const mockBotInfinite = {
    blockAt: () => ({ name: 'oak_log', boundingBox: 'block' })
  };

  const customConfig = { ...forestryConfig, MAX_LOGS_PER_TREE: 10 };
  const analyzer = new TreeAnalyzer(mockBotInfinite, treeData, customConfig);
  const logs = analyzer.findConnectedLogs({ x: 0, y: 64, z: 0 }, 'oak', { maxLogs: 10 });

  assert.strictEqual(logs.length, 10);
});
