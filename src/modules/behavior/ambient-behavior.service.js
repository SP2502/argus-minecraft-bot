const ambientConfig = require('./ambient.config');
const Priorities = require('../../shared/config/priorities');

/**
 * AmbientBehaviorService - Autonomous Homestead Stewardship, Day/Night Sleep Routine,
 * Auto-Eating, and Low-Priority Homestead Maintenance.
 * 
 * Invariant: All ambient tasks execute at Priorities.BACKGROUND (20) or Priorities.IDLE (30)
 * and yield immediately to any incoming human player command.
 */
class AmbientBehaviorService {
  /**
   * @param {import('mineflayer').Bot} bot - Mineflayer bot instance
   * @param {import('../core/BotContext')} ctx - Central dependency container
   */
  constructor(bot, ctx = null) {
    this.bot = bot;
    this.ctx = ctx;
    this.enabled = ambientConfig.ENABLED;
    this.isSleeping = false;
    this.currentBed = null;
    this.lastMaintenanceTime = 0;
    this.lastPatrolTime = 0;
    this.lastEatTime = 0;
    this.stats = {
      timesSlept: 0,
      itemsEaten: 0,
      maintenanceRuns: 0,
      lastActivity: 'Idle'
    };

    // Attach bot wake listener if bot exists
    if (this.bot && typeof this.bot.on === 'function') {
      this.bot.on('wake', () => {
        this.isSleeping = false;
        this.currentBed = null;
        if (this.ctx && this.ctx.events) {
          this.ctx.events.emit('ambient.wake', { reason: 'morning_or_interrupted' });
        }
      });
    }
  }

  /**
   * Evaluates environment and schedules ambient behaviors when the bot is idling.
   * Called by AIBrain.tick() when the task queue is empty.
   * 
   * @param {number} [idleDurationMs=0] - Time elapsed in idle state
   * @returns {Promise<boolean>} True if an ambient action or task was triggered
   */
  async evaluate(idleDurationMs = 0) {
    if (!this.enabled || !this.bot) return false;

    // Do not trigger ambient actions if critical or retreating
    if (this.ctx && this.ctx.safety && this.ctx.safety.isCritical()) {
      if (this.isSleeping) await this.wake();
      return false;
    }

    // 1. Day / Night Bed Sleeping Routine (High Priority Ambient)
    if (this.isNightOrStorm()) {
      const sleepResult = await this.checkSleepRoutine();
      if (sleepResult) return true;
    } else if (this.isSleeping) {
      // It's daytime and bot is still sleeping: wake up!
      await this.wake();
    }

    // 2. Autonomous Hunger Recovery (Auto-Eat)
    const ate = await this.checkAutoEat();
    if (ate) return true;

    // 2.5 Autonomous Tool Maintenance & Upgrades in Idle
    const toolUpgraded = await this.checkToolUpgradeRoutine();
    if (toolUpgraded) return true;

    // 3. Ambient Maintenance Tasks (Farming / Warehouse Organization)
    if (idleDurationMs >= ambientConfig.IDLE_TRIGGER_DELAY_MS) {
      const maintenanceTriggered = await this.checkMaintenanceRoutine();
      if (maintenanceTriggered) return true;
    }

    return false;
  }

  /**
   * Checks whether the current world state is night or an active thunderstorm.
   * Minecraft night: timeOfDay between 12541 and 23458 ticks.
   * 
   * @returns {boolean}
   */
  isNightOrStorm() {
    if (!this.bot) return false;
    const time = this.bot.time;
    const isNight = Boolean(time && time.timeOfDay >= 12541 && time.timeOfDay <= 23458);
    const isStorm = Boolean(this.bot.isRaining && (this.bot.thunderState > 0 || this.bot.thunder));
    return isNight || isStorm;
  }

  /**
   * Attempts to locate a nearby bed and sleep through the night/storm safely.
   * @returns {Promise<boolean>}
   */
  async checkSleepRoutine() {
    if (this.isSleeping) return true;

    // Find nearest bed container/block
    let bed = null;
    if (this.ctx && this.ctx.target) {
      bed = this.ctx.target.findNearestBlock(ambientConfig.BED_BLOCK_NAMES, ambientConfig.BED_SEARCH_RADIUS);
    }

    if (!bed) return false;

    try {
      this.stats.lastActivity = 'Navigating to Bed';

      // Navigate to bed within interaction range
      if (this.ctx && this.ctx.nav) {
        await this.ctx.nav.goTo(bed.position, {
          range: ambientConfig.BED_INTERACTION_RANGE,
          allowBreak: false
        });
      }

      // Execute sleep action
      if (typeof this.bot.sleep === 'function') {
        await this.bot.sleep(bed);
        this.isSleeping = true;
        this.currentBed = bed.position;
        this.stats.timesSlept++;
        this.stats.lastActivity = 'Sleeping';

        if (this.ctx && this.ctx.events) {
          this.ctx.events.emit('ambient.sleep', {
            bedPosition: bed.position,
            timesSlept: this.stats.timesSlept
          });
        }

        if (this.ctx && this.ctx.messageRouter) {
          await this.ctx.messageRouter.send('Resting in bed to safely skip the night...');
        }
        return true;
      }
    } catch (err) {
      console.warn('[AmbientBehaviorService] Could not sleep in bed:', err.message);
      this.isSleeping = false;
      this.currentBed = null;
    }

    return false;
  }

  /**
   * Wakes the bot up from sleep.
   * @returns {Promise<void>}
   */
  async wake() {
    if (!this.isSleeping && (!this.bot || !this.bot.isSleeping)) return;

    try {
      if (this.bot && typeof this.bot.wake === 'function') {
        await this.bot.wake();
      }
      this.isSleeping = false;
      this.currentBed = null;
      this.stats.lastActivity = 'Awake';

      if (this.ctx && this.ctx.events) {
        this.ctx.events.emit('ambient.wake', { reason: 'manual_or_morning' });
      }

      if (this.ctx && this.ctx.messageRouter) {
        await this.ctx.messageRouter.send('Awake and ready for work!');
      }
    } catch (err) {
      console.warn('[AmbientBehaviorService] Error waking bot:', err.message);
      this.isSleeping = false;
      this.currentBed = null;
    }
  }

  /**
   * Checks bot hunger and autonomously eats food if available.
   * @returns {Promise<boolean>}
   */
  async checkAutoEat() {
    if (!this.bot || this.bot.food === undefined) return false;
    if (this.bot.food >= ambientConfig.MIN_FOOD_THRESHOLD) return false;

    // Scan inventory for edible food
    const items = this.bot.inventory ? this.bot.inventory.items() : [];
    const foodItem = items.find((i) => ambientConfig.EDIBLE_FOODS.includes(i.name));

    if (!foodItem) return false;

    // Delegate to ActionQueueService with priority RESOURCE_DEPLETION
    if (this.ctx && this.ctx.actionQueue) {
      try {
        await this.ctx.actionQueue.enqueue(
          async () => {
            if (typeof this.bot.equip === 'function') {
              await this.bot.equip(foodItem, 'hand');
            }
            if (typeof this.bot.consume === 'function') {
              await this.bot.consume();
            }
            this.stats.itemsEaten++;
            this.lastEatTime = Date.now();
            this.stats.lastActivity = `Ate ${foodItem.name}`;

            if (this.ctx.events) {
              this.ctx.events.emit('ambient.ate', {
                food: foodItem.name,
                currentFood: this.bot.food,
                totalEaten: this.stats.itemsEaten
              });
            }
          },
          Priorities.RESOURCE_DEPLETION,
          { timeoutMs: 8000 }
        );
        return true;
      } catch (err) {
        console.warn('[AmbientBehaviorService] Failed to auto-eat:', err.message);
      }
    }

    return false;
  }

  /**
   * Evaluates background maintenance tasks and enqueues low-priority jobs in TaskManager.
   * @returns {Promise<boolean>}
   */
  async checkMaintenanceRoutine() {
    if (!this.ctx || !this.ctx.taskManager) return false;

    const now = Date.now();
    if (now - this.lastMaintenanceTime < ambientConfig.MAINTENANCE_COOLDOWN_MS) {
      return false;
    }

    // 1. Inventory Fullness Maintenance -> Autonomous Warehouse Deposit
    if (this.ctx.inv && typeof this.ctx.inv.countUsedSlots === 'function') {
      const usedSlots = this.ctx.inv.countUsedSlots();
      const totalSlots = 36;
      if ((usedSlots / totalSlots) >= ambientConfig.INVENTORY_FULL_THRESHOLD) {
        this.ctx.taskManager.addTask(
          'logistics',
          { mode: 'sort' },
          Priorities.BACKGROUND,
          'AmbientScheduler',
          ['movement', 'inventory', 'warehouse']
        );
        this.lastMaintenanceTime = now;
        this.stats.maintenanceRuns++;
        this.stats.lastActivity = 'Sorting Storage';
        return true;
      }
    }

    // 2. Mature Crop Maintenance -> Autonomous Homestead Harvesting
    if (this.ctx.target && typeof this.ctx.target.findNearestBlock === 'function') {
      const cropBlockNames = ['wheat', 'carrots', 'potatoes', 'beetroots', 'melon', 'pumpkin'];
      const crop = this.ctx.target.findNearestBlock(cropBlockNames, 32);
      if (crop) {
        // MC 1.21+ uses block.getProperties().age; legacy uses block.metadata
        let cropAge = -1;
        try {
          if (typeof crop.getProperties === 'function') {
            const props = crop.getProperties();
            cropAge = props && props.age !== undefined ? parseInt(props.age, 10) : (crop.metadata || 0);
          } else {
            cropAge = crop.metadata !== undefined ? crop.metadata : -1;
          }
        } catch (e) {
          cropAge = crop.metadata !== undefined ? crop.metadata : -1;
        }

        // Melon/Pumpkin are always harvestable when present, wheat mature at age 7, others at 3 or 7
        const isMature = (['melon', 'pumpkin'].includes(crop.name)) ||
          (cropAge >= 7) ||
          (crop.name === 'beetroots' && cropAge >= 3);

        if (isMature) {
          this.ctx.taskManager.addTask(
            'farm',
            { targetCrop: crop.name === 'carrots' ? 'carrot' : crop.name === 'potatoes' ? 'potato' : crop.name === 'beetroots' ? 'beetroot' : crop.name, opportunistic: true },
            Priorities.BACKGROUND,
            'AmbientScheduler',
            ['movement', 'inventory']
          );
          this.lastMaintenanceTime = now;
          this.stats.maintenanceRuns++;
          this.stats.lastActivity = 'Tending Farm';
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Autonomous Idle Tool Maintenance & Upgrades.
   * Periodically crafts missing tools or upgrades existing tools (wood -> stone -> iron -> diamond).
   * @returns {Promise<boolean>}
   */
  async checkToolUpgradeRoutine() {
    if (!this.ctx || !this.ctx.tools || typeof this.ctx.tools.maintainAndUpgradeTools !== 'function') {
      return false;
    }

    const now = Date.now();
    if (this.lastToolCheck && now - this.lastToolCheck < 10000) {
      return false;
    }
    this.lastToolCheck = now;

    try {
      const res = await this.ctx.tools.maintainAndUpgradeTools();
      if (res && res.upgraded) {
        this.stats.lastActivity = `Upgraded ${res.tool}`;
        if (this.ctx.events) {
          this.ctx.events.emit('ambient.tool_upgraded', res);
        }
        if (this.ctx.messageRouter) {
          this.ctx.messageRouter.send(3, `[Idle Tool Maintenance] Upgraded tools: crafted and equipped ${res.tool}.`);
        }
        return true;
      }
    } catch (err) {
      console.warn('[AmbientBehaviorService] Tool maintenance failed:', err.message);
    }

    return false;
  }

  /**
   * Enables or disables autonomous ambient behaviors.
   * @param {boolean} [enable] - New state (toggles if undefined)
   * @returns {boolean} Resulting active state
   */
  async toggle(enable = undefined) {
    this.enabled = enable !== undefined ? Boolean(enable) : !this.enabled;

    if (!this.enabled && this.isSleeping) {
      await this.wake();
    }

    if (this.ctx && this.ctx.events) {
      this.ctx.events.emit('ambient.toggled', { enabled: this.enabled });
    }

    return this.enabled;
  }

  /**
   * Health ping and telemetry reporting.
   * @returns {{ ok: boolean, enabled: boolean, isSleeping: boolean, stats: Object }}
   */
  ping() {
    return {
      ok: true,
      enabled: this.enabled,
      isSleeping: this.isSleeping,
      stats: this.stats
    };
  }
}

module.exports = AmbientBehaviorService;
