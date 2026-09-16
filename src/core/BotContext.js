const eventBus = require('./EventBus');
const { NavigationService, LocationRegistry } = require('../modules/navigation');
const TargetFinderService = require('../../services/TargetFinderService');
const { InventoryService, CraftingService } = require('../modules/inventory');
const ActionQueueService = require('../../services/ActionQueueService');
const SafetyService = require('../../services/SafetyService');
const ToolService = require('../../services/ToolService');
const { CombatService: CombatHelperService } = require('../modules/combat');
const { LogisticsService } = require('../modules/logistics');
const { AmbientBehaviorService, HumanoidBehaviorService } = require('../modules/behavior');
const SkillRegistry = require('./SkillRegistry');
const { TaskManager } = require('./TaskManager');
const { PermissionManager } = require('../modules/security');
const MessageRouter = require('../shared/communication/MessageRouter');
const WebhookDispatcher = require('../shared/communication/WebhookDispatcher');

// Unified Command & NLP Subsystem
const conversationContext = require('../modules/commands/ConversationContextManager');
const confirmations = require('../modules/commands/ConfirmationManager');
const intentParser = require('../modules/nlp/IntentParser');
const CommandPlanner = require('../modules/commands/CommandPlanner');
const UnifiedCommandGateway = require('../modules/commands/UnifiedCommandGateway');

/**
 * BotContext - Dependency Injection Container
 * 
 * Provides unified access to all singleton services, managers, NLP systems, event bus, and bot state.
 * Passed to every Skill, Task, and Module to guarantee zero duplication of service logic.
 */
class BotContext {
  /**
   * @param {import('mineflayer').Bot} bot - Mineflayer bot instance
   */
  constructor(bot) {
    this.bot = bot;
    this.events = eventBus;
    this.eventBus = eventBus;
    this.skills = SkillRegistry;

    // 1. Core Data Registries & Services
    this.locations = new LocationRegistry();
    this.nav = new NavigationService(bot, this.locations);
    this.target = new TargetFinderService(bot);
    this.inv = new InventoryService(bot, this);
    this.inventory = this.inv; // Alias
    this.actionQueue = new ActionQueueService(bot);
    this.safety = new SafetyService(bot, this);
    this.tools = new ToolService(bot, this);
    this.tool = this.tools; // Alias
    this.crafting = new CraftingService(bot, this);
    this.combat = new CombatHelperService(bot, this);
    this.logistics = new LogisticsService(bot, this);
    this.ambient = new AmbientBehaviorService(bot, this);
    this.humanoid = new HumanoidBehaviorService(bot, this);

    // 2. Infrastructure, Security, & Communication
    this.webhooks = new WebhookDispatcher();
    this.messageRouter = new MessageRouter(bot, process.env.OWNER_USERNAME, this.webhooks);
    this.permissionManager = new PermissionManager();
    this.permissions = this.permissionManager; // Alias
    this.serverAuth = require('../modules/server-auth').serverAuthManager;
    this.taskManager = new TaskManager(this);

    // 3. Natural Language Understanding & Unified Command Gateway
    this.conversationContext = conversationContext;
    this.confirmations = confirmations;
    this.nlp = intentParser;
    this.commandPlanner = new CommandPlanner(this);
    this.commandGateway = new UnifiedCommandGateway(this);

    this.currentTask = null;
  }

  /**
   * Helper to load and instantiate a registered skill with this context.
   * @param {string} name - Skill name
   * @returns {import('../skills/BaseSkill')}
   */
  loadSkill(name) {
    return this.skills.loadSkill(name, this);
  }

  /**
   * Generates a plain-object snapshot of the bot's runtime status for dashboards and telemetry.
   * @returns {Object}
   */
  getStatus() {
    const position = this.bot && this.bot.entity && this.bot.entity.position
      ? {
          x: Math.round(this.bot.entity.position.x * 10) / 10,
          y: Math.round(this.bot.entity.position.y * 10) / 10,
          z: Math.round(this.bot.entity.position.z * 10) / 10
        }
      : { x: 0, y: 0, z: 0 };

    return {
      username: this.bot ? this.bot.username : 'Unknown',
      health: this.bot ? this.bot.health : 0,
      food: this.bot ? this.bot.food : 0,
      position,
      isMoving: Boolean(this.nav && (this.nav.currentGoal || this.nav.isFollowing)),
      currentTask: this.currentTask ? (this.currentTask.skillName || this.currentTask.name) : 'Idle',
      uptime: process.uptime()
    };
  }
}

module.exports = BotContext;
