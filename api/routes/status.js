const express = require('express');

/**
 * Creates status and health routing endpoints.
 * @param {import('../../core/BotContext')} [ctx] - BotContext reference
 * @returns {express.Router}
 */
function createStatusRouter(ctx) {
  const router = express.Router();

  /**
   * GET /health - Basic health check
   */
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  /**
   * GET /status - Detailed bot telemetry status
   */
  router.get('/status', (req, res) => {
    if (ctx && typeof ctx.getStatus === 'function') {
      res.json(ctx.getStatus());
    } else {
      res.json({
        status: 'initialized',
        uptime: process.uptime()
      });
    }
  });

  /**
   * GET /nav-status - Navigation service telemetry (isFollowing, isStuck, currentGoal)
   */
  router.get('/nav-status', (req, res) => {
    if (ctx && ctx.nav && typeof ctx.nav.getNavStatus === 'function') {
      res.json(ctx.nav.getNavStatus());
    } else {
      res.json({
        isFollowing: false,
        isStuck: false,
        currentGoal: null
      });
    }
  });

  /**
   * GET /inv-status - Inventory service telemetry (usedSlots, totalSlots, isFull, topValueItems)
   */
  router.get('/inv-status', (req, res) => {
    if (ctx && ctx.inv && typeof ctx.inv.getStatus === 'function') {
      res.json(ctx.inv.getStatus());
    } else {
      res.json({
        usedSlots: 0,
        totalSlots: 36,
        isFull: false,
        topValueItems: []
      });
    }
  });

  /**
   * GET /safety-status - Safety service telemetry (isCritical, isLowHealth, isNearLava, etc.)
   */
  router.get('/safety-status', (req, res) => {
    if (ctx && ctx.safety && typeof ctx.safety.getStatus === 'function') {
      res.json(ctx.safety.getStatus());
    } else {
      res.json({
        isCritical: false,
        isLowHealth: false,
        isLowHunger: false,
        isNearLava: false,
        isNight: false,
        shouldRetreat: false
      });
    }
  });

  /**
   * GET /tool-status - Tool service telemetry (bestPickaxe, bestAxe, bestSword, isAboutToBreak)
   */
  router.get('/tool-status', (req, res) => {
    const toolService = ctx ? (ctx.tools || ctx.tool) : null;
    if (toolService && typeof toolService.getStatus === 'function') {
      res.json(toolService.getStatus());
    } else {
      res.json({
        bestPickaxe: null,
        bestAxe: null,
        bestSword: null,
        isAboutToBreak: false
      });
    }
  });

  /**
   * GET /stats/woodcutting - Forestry metrics and session stats
   */
  router.get('/stats/woodcutting', async (req, res) => {
    const Statistics = require('../../models/Statistics');
    try {
      const statsDoc = await Statistics.findOne({}).sort({ startTime: -1 });
      const woodcutting = (statsDoc && statsDoc.woodcutting) || {
        logsCollected: 0,
        treesCut: 0,
        saplingsPlanted: 0,
        saplingsCollected: 0,
        applesCollected: 0,
        timeSpentMs: 0,
        skippedTrees: 0
      };
      res.json({ ok: true, stats: woodcutting });
    } catch (err) {
      res.json({
        ok: true,
        stats: {
          logsCollected: 0,
          treesCut: 0,
          saplingsPlanted: 0,
          saplingsCollected: 0,
          applesCollected: 0,
          timeSpentMs: 0,
          skippedTrees: 0
        }
      });
    }
  });

  /**
   * GET /stats/combat - Combat and defense metrics
   */
  router.get('/stats/combat', async (req, res) => {
    const Statistics = require('../../models/Statistics');
    try {
      const statsDoc = await Statistics.findOne({}).sort({ startTime: -1 });
      const combat = (statsDoc && statsDoc.combat) || {
        mobsKilled: 0,
        damageDealt: 0,
        damageTaken: 0,
        deaths: 0,
        timeSpentMs: 0
      };
      res.json({ ok: true, stats: combat });
    } catch (err) {
      res.json({
        ok: true,
        stats: {
          mobsKilled: 0,
          damageDealt: 0,
          damageTaken: 0,
          deaths: 0,
          timeSpentMs: 0
        }
      });
    }
  });

  /**
   * GET /stats/crafting - Crafting and smelting operational metrics
   */
  router.get('/stats/crafting', async (req, res) => {
    const Statistics = require('../../models/Statistics');
    try {
      const statsDoc = await Statistics.findOne({}).sort({ startTime: -1 });
      const crafting = (statsDoc && statsDoc.crafting) || {
        itemsCrafted: 0,
        itemsSmelted: 0,
        recipesResolved: 0
      };
      res.json({ ok: true, stats: crafting });
    } catch (err) {
      res.json({
        ok: true,
        stats: {
          itemsCrafted: 0,
          itemsSmelted: 0,
          recipesResolved: 0
        }
      });
    }
  });

  /**
   * GET /stats/building - Construction and architectural metrics
   */
  router.get('/stats/building', async (req, res) => {
    const Statistics = require('../../models/Statistics');
    try {
      const statsDoc = await Statistics.findOne({}).sort({ startTime: -1 });
      const building = (statsDoc && statsDoc.building) || {
        structuresBuilt: 0,
        blocksPlaced: 0,
        scaffoldingUsed: 0
      };
      res.json({ ok: true, stats: building });
    } catch (err) {
      res.json({
        ok: true,
        stats: {
          structuresBuilt: 0,
          blocksPlaced: 0,
          scaffoldingUsed: 0
        }
      });
    }
  });

  /**
   * GET /stats/logistics - Warehouse and storage management metrics
   */
  router.get('/stats/logistics', async (req, res) => {
    const Statistics = require('../../models/Statistics');
    try {
      const statsDoc = await Statistics.findOne({}).sort({ startTime: -1 });
      const logistics = (statsDoc && statsDoc.logistics) || {
        chestsIndexed: 0,
        itemsSorted: 0,
        kitsRestocked: 0
      };
      res.json({ ok: true, stats: logistics });
    } catch (err) {
      res.json({
        ok: true,
        stats: {
          chestsIndexed: 0,
          itemsSorted: 0,
          kitsRestocked: 0
        }
      });
    }
  /**
   * GET /stats/ambient - Autonomous ambient behaviors and homestead stewardship status
   */
  router.get('/stats/ambient', async (req, res) => {
    try {
      const ambientStatus = ctx.ambient ? ctx.ambient.ping() : { ok: false };
      res.json({
        ok: true,
        ambient: ambientStatus
      });
    } catch (err) {
      res.json({ ok: false, error: err.message });
    }
  });

  return router;
}

module.exports = createStatusRouter;
