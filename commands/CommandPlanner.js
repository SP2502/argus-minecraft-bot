const commandSchemas = require('./CommandSchemas');
const Priorities = require('../config/priorities');
const { requiresConfirmation } = require('../config/dangerousCommands');
const AmbiguityError = require('./errors/AmbiguityError');

/**
 * CommandPlanner - Compiles NLP parse outputs into validated execution plans.
 * Resolves locations, constructs dependency graphs for compound commands, and flags ambiguities.
 */
class CommandPlanner {
  /**
   * @param {import('../core/BotContext')} ctx - Central dependency container
   */
  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Translates NLP parsed intents and entities into an executable plan structure.
   * 
   * @param {Object} parseResult - Output from IntentParser.parse()
   * @param {Object} [requestContext={}] - Request and conversation metadata
   * @returns {Promise<Object>} Formulated plan
   */
  async plan(parseResult, requestContext = {}) {
    const { intents, entities } = parseResult;
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    if (!intents || intents.length === 0) {
      return {
        planId,
        type: 'empty',
        operations: [],
        ambiguities: [],
        missing: []
      };
    }

    // 1. Single Command Plan
    if (intents.length === 1) {
      const op = await this._buildOperation(intents[0], entities, requestContext, 0);
      return {
        planId,
        type: op.isControl ? 'control' : 'single',
        operations: [op],
        ambiguities: op.ambiguities || [],
        missing: op.missing || []
      };
    }

    // 2. Compound Sequential Command Plan (e.g. "mine 64 diamonds then go home and store all")
    const operations = [];
    const allAmbiguities = [];
    const allMissing = [];
    let previousOpId = null;

    for (let i = 0; i < intents.length; i++) {
      const intentItem = intents[i];
      const opEntities = intentItem.entities || entities;
      const op = await this._buildOperation(intentItem, opEntities, requestContext, i);

      // Link dependency chain
      if (previousOpId && !op.isControl) {
        op.dependsOn.push(previousOpId);
      }
      previousOpId = op.operationId;

      if (op.ambiguities && op.ambiguities.length > 0) {
        allAmbiguities.push(...op.ambiguities);
      }
      if (op.missing && op.missing.length > 0) {
        allMissing.push(...op.missing);
      }

      operations.push(op);
    }

    return {
      planId,
      type: 'sequence',
      operations,
      ambiguities: allAmbiguities,
      missing: allMissing
    };
  }

  /**
   * Builds an individual operation descriptor with schema lookups and entity validation.
   * @private
   */
  async _buildOperation(intentItem, entities, requestContext, index) {
    const intentName = intentItem.name;
    const schema = commandSchemas[intentName] || {
      requiredPermission: 'admin',
      priorityKey: 'AUTONOMOUS',
      locks: ['movement', 'inventory'],
      skillName: intentName,
      dangerous: false
    };

    const operationId = `op_${Date.now()}_${index}`;
    const priority = Priorities[schema.priorityKey] || Priorities.AUTONOMOUS;
    const isDangerous = schema.dangerous || requiresConfirmation(intentName, entities);
    const ambiguities = [];
    const missing = [];

    // Parameter formulation based on intent domain
    const params = { ...(intentItem.definition ? intentItem.definition.defaultParams : {}) };

    // 1. Mining Parameters
    if (intentName === 'mine') {
      if (entities.targetOre) params.targetOre = entities.targetOre;
      if (entities.quantity && entities.quantity.value) params.quantity = entities.quantity.value;
      if (entities.modifiers && entities.modifiers.opportunistic !== undefined) {
        params.opportunistic = entities.modifiers.opportunistic;
      }
    }

    // 2. Farming Parameters
    if (intentName === 'farm') {
      if (entities.crop) params.targetCrop = entities.crop;
      if (entities.modifiers && entities.modifiers.useBoneMeal !== undefined) {
        params.useBoneMeal = entities.modifiers.useBoneMeal;
      }
      if (entities.name) params.farmName = entities.name;
    }

    // 2b. Woodcutting Parameters
    if (intentName === 'chop_tree') {
      if (entities.treeType) params.treeType = entities.treeType;
      if (entities.quantity && entities.quantity.value !== undefined) params.quantity = entities.quantity.value;
      if (entities.quantity && entities.quantity.mode === 'all') params.quantity = null;
      if (entities.location && entities.location.name) params.location = entities.location.name;
    }

    // 2c. Combat Parameters
    if (intentName === 'combat') {
      params.mode = 'hunt';
      if (entities.mobType) params.targetMob = entities.mobType;
      if (entities.quantity && entities.quantity.value !== undefined) params.quantity = entities.quantity.value;
    }
    if (intentName === 'guard') {
      params.mode = 'guard';
      if (entities.player === 'me' || !entities.player) {
        params.targetPlayer = (requestContext && requestContext.senderId) || entities.player || 'sender';
      } else if (entities.player) {
        params.targetPlayer = entities.player;
      }
      if (entities.location && entities.location.name) params.location = entities.location.name;
    }
    if (intentName === 'patrol') {
      params.mode = 'patrol';
      if (entities.location && entities.location.name) params.location = entities.location.name;
    }

    // 2d. Crafting & Smelting Parameters
    if (intentName === 'craft') {
      params.mode = 'craft';
      if (entities.item) params.item = entities.item;
      if (entities.quantity && entities.quantity.value !== undefined) params.quantity = entities.quantity.value;
    }
    if (intentName === 'smelt') {
      params.mode = 'smelt';
      if (entities.item) params.item = entities.item;
      if (entities.quantity && entities.quantity.value !== undefined) params.quantity = entities.quantity.value;
      if (entities.fuel) params.fuel = entities.fuel;
    }

    // 2e. Building Parameters
    if (intentName === 'build') {
      params.structure = entities.structure || 'shelter';
      if (entities.material) params.material = entities.material;
      if (entities.dimensions) {
        params.dimensions = {};
        if (params.structure === 'wall') {
          params.dimensions.length = entities.dimensions.dim1;
          params.dimensions.height = entities.dimensions.dim2;
        } else if (params.structure === 'floor') {
          params.dimensions.width = entities.dimensions.dim1;
          params.dimensions.depth = entities.dimensions.dim2;
        } else if (params.structure === 'cube') {
          params.dimensions.width = entities.dimensions.dim1;
          params.dimensions.height = entities.dimensions.dim2;
          params.dimensions.depth = entities.dimensions.dim3 || entities.dimensions.dim1;
        } else if (params.structure === 'stairs') {
          params.dimensions.height = entities.dimensions.dim1;
        } else {
          params.dimensions.width = entities.dimensions.dim1;
          params.dimensions.height = entities.dimensions.dim2;
          if (entities.dimensions.dim3) params.dimensions.depth = entities.dimensions.dim3;
        }
      }
    }

    // 2f. Logistics Parameters
    if (intentName === 'sort_warehouse') {
      params.mode = 'sort';
    }
    if (intentName === 'restock') {
      params.mode = 'restock';
      params.kit = entities.kit || 'default';
    }
    if (intentName === 'index_chests') {
      params.mode = 'index';
      if (entities.quantity && entities.quantity.value) params.radius = entities.quantity.value;
    }
    if (intentName === 'find_item') {
      params.mode = 'locate';
      if (entities.item) params.item = entities.item;
    }

    // 2g. Ambient Parameters
    if (intentName === 'ambient_mode') {
      const text = (intentItem && intentItem.clauseText) || (requestContext && requestContext.message) || '';
      const lower = text.toLowerCase();
      if (lower.includes('off') || lower.includes('disable') || lower.includes('stop')) {
        params.enabled = false;
      } else if (lower.includes('on') || lower.includes('enable') || lower.includes('start')) {
        params.enabled = true;
      } else {
        params.enabled = undefined;
      }
    }

    // 3. Navigation Parameters & Location Resolution
    if (intentName === 'go_to' || intentName === 'go_home') {
      if (entities.location) {
        if (entities.location.type === 'coordinates') {
          params.position = { x: entities.location.x, y: entities.location.y, z: entities.location.z };
          params.needsSafeY = entities.location.needsSafeY;
        } else if (entities.location.type === 'relative_coordinates') {
          params.relativeOffset = { dx: entities.location.dx, dy: entities.location.dy, dz: entities.location.dz };
        } else if (entities.location.type === 'named_location') {
          // Resolve named location against LocationRegistry
          const locName = entities.location.name;
          const resolution = await this._resolveNamedLocation(locName);
          if (resolution.ambiguous) {
            ambiguities.push({
              type: 'location',
              name: locName,
              options: resolution.options,
              prompt: resolution.prompt
            });
          } else if (resolution.location) {
            params.position = { x: resolution.location.x, y: resolution.location.y, z: resolution.location.z };
            params.locationName = resolution.location.name;
          } else {
            missing.push(`Location '${locName}' is not registered.`);
          }
        }
      } else if (intentName === 'go_home') {
        params.targetLocation = 'primary_base';
      }
    }

    // 4. Inventory Parameters
    if (intentName === 'store_item' || intentName === 'retrieve_item' || intentName === 'drop_item') {
      if (entities.item) params.item = entities.item;
      if (entities.quantity && entities.quantity.value) params.quantity = entities.quantity.value;
      if (entities.quantity && entities.quantity.mode === 'all') params.all = true;
    }
    if (intentName === 'store_all' || intentName === 'drop_all') {
      if (entities.item) params.item = entities.item;
      params.all = true;
    }

    // 5. Security & Permission Parameters
    if (intentName === 'grant_permission') {
      if (entities.player) params.player = entities.player;
      if (entities.role) params.role = entities.role;
      if (entities.time && entities.time.durationMs) params.durationMs = entities.time.durationMs;
    }
    if (intentName === 'revoke_permission') {
      if (entities.player) params.player = entities.player;
    }

    // 6. Macro Parameters
    if (intentName === 'create_macro') {
      if (entities.name) params.name = entities.name;
      if (entities.steps) params.steps = entities.steps;
    }
    if (intentName === 'run_macro' || intentName === 'delete_macro') {
      if (entities.name) params.name = entities.name;
    }

    return {
      operationId,
      intentName,
      skillName: schema.skillName || intentName,
      params,
      requiredPermission: schema.requiredPermission || 'guest',
      priority,
      locks: [...schema.locks],
      dangerous: isDangerous,
      isControl: Boolean(schema.isControl),
      available: schema.available !== false,
      dependsOn: [],
      ambiguities,
      missing
    };
  }

  /**
   * Resolves a named location or detects ambiguous multi-location matches.
   * @private
   */
  async _resolveNamedLocation(queryName) {
    if (!this.ctx || !this.ctx.locations) {
      return { location: null, ambiguous: false };
    }

    const clean = queryName.toLowerCase().trim();

    // Query all bases if "base" was requested
    if (clean === 'base' || clean === 'bases') {
      try {
        const bases = await this.ctx.locations.listByType('base');
        if (bases && bases.length > 1) {
          const options = bases.map((b, idx) => ({
            index: idx + 1,
            label: `${b.name} (${Math.round(b.x)}, ${Math.round(b.y)}, ${Math.round(b.z)})`,
            name: b.name,
            x: b.x,
            y: b.y,
            z: b.z
          }));
          return {
            ambiguous: true,
            options,
            prompt: `Multiple bases found. Which base would you like to travel to? ${options.map((o) => `${o.index}) ${o.label}`).join(' ')}`
          };
        } else if (bases && bases.length === 1) {
          return { location: bases[0], ambiguous: false };
        }
      } catch (e) {
        // ignore
      }
    }

    // Query specific named base
    try {
      const loc = await this.ctx.locations.getBase(clean);
      if (loc) return { location: loc, ambiguous: false };
    } catch (e) {
      // ignore
    }

    return { location: null, ambiguous: false };
  }
}

module.exports = CommandPlanner;
