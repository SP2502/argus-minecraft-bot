/**
 * SkillRegistry - Registry and factory for dynamically instantiating Skills.
 */

// Skill mapping table
const registry = {
  mine: require('../skills/mining/MineSkill'),
  farm: require('../skills/farming/FarmSkill'),
  chop_tree: require('../skills/woodcutting/ChopTreeSkill'),
  combat: require('../skills/combat/CombatSkill'),
  craft: require('../skills/crafting/CraftSkill'),
  build: require('../skills/building/BuildSkill'),
  logistics: require('../skills/logistics/LogisticsSkill')
};

/**
 * Registers a new skill class under a unique name.
 * @param {string} name - Skill identifier
 * @param {typeof import('../skills/BaseSkill')} SkillClass - Skill constructor
 */
function registerSkill(name, SkillClass) {
  registry[name.toLowerCase()] = SkillClass;
}

/**
 * Instantiates a registered skill with the provided BotContext.
 * @param {string} name - Registered skill name
 * @param {import('./BotContext')} ctx - BotContext instance
 * @returns {import('../skills/BaseSkill')} Instantiated skill instance
 * @throws {Error} If skill is not registered
 */
function loadSkill(name, ctx) {
  const normalized = name.toLowerCase();
  const SkillClass = registry[normalized];
  if (!SkillClass) {
    throw new Error(`[SkillRegistry] Skill '${name}' is not registered. Available skills: [${Object.keys(registry).join(', ')}]`);
  }
  return new SkillClass(ctx);
}

module.exports = {
  registry,
  registerSkill,
  loadSkill
};
