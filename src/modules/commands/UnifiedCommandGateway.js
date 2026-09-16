const mongoose = require('mongoose');
const commandPolicies = require('../../../config/commandPolicies');
const CommandResponse = require('./CommandResponse');
const CommandAudit = require('../../../models/CommandAudit');
const Macro = require('./macro.model');
const eventBus = require('../../core/EventBus');
const Priorities = require('../../../config/priorities');

/**
 * UnifiedCommandGateway - The SINGLE architectural entry point for all command execution
 * across Minecraft Chat, Web Dashboard, and REST API.
 * 
 * Enforces authentication, rate-limiting, conversation context resolution, NLP translation,
 * multi-operation planning, explicit confirmation checks, and TaskManager dispatch.
 */
class UnifiedCommandGateway {
  /**
   * @param {import('../core/BotContext')} ctx - BotContext dependency container
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.permissions = ctx.permissionManager || ctx.permissions;
    this.contextManager = ctx.conversationContext;
    this.intentParser = ctx.nlp;
    this.commandPlanner = ctx.commandPlanner;
    this.confirmationManager = ctx.confirmations;
    this.taskManager = ctx.taskManager;
    this.messageRouter = ctx.messageRouter;
  }

  /**
   * The only execution entry point for all commands across all sources.
   * 
   * @param {Object} request
   * @param {'minecraft'|'dashboard'|'rest'} request.source - Origin platform
   * @param {string} request.senderId - Unique sender identifier (MC username or dashboard ID)
   * @param {string} [request.senderDisplayName] - Friendly display name
   * @param {string} request.message - Raw natural-language command text
   * @param {string|null} [request.sessionId=null] - Session or socket connection ID
   * @param {Object} [request.metadata={}] - Request metadata (IP, channel, etc.)
   * @returns {Promise<CommandResponse>}
   * 
   * @example
   * const response = await gateway.execute({
   *   source: 'minecraft',
   *   senderId: 'OwnerPlayer',
   *   message: 'mine 64 diamonds then go home'
   * });
   */
  async execute(request) {
    const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    request.commandId = commandId;

    const rawText = request.message || '';
    let normalized = rawText.replace(/§[0-9a-fk-or]/gi, '').trim();

    // 1. Prefix Policy Check
    if (commandPolicies.REQUIRE_PREFIX && commandPolicies.PREFIX) {
      if (!normalized.startsWith(commandPolicies.PREFIX)) {
        return CommandResponse.info('Ignored: command prefix not present.');
      }
      normalized = normalized.slice(commandPolicies.PREFIX.length).trim();
    }

    // 2. Length Validation
    if (normalized.length === 0) {
      return CommandResponse.error('Empty command received.');
    }
    if (normalized.length > commandPolicies.MAX_COMMAND_LENGTH) {
      return CommandResponse.error(`Command exceeds maximum length (${commandPolicies.MAX_COMMAND_LENGTH} chars).`);
    }

    // 3. Rate Limiting Check
    if (this.permissions && !this.permissions.checkRateLimit(request.senderId)) {
      await this.createAudit({
        commandId,
        request,
        normalizedText: normalized,
        allowed: false,
        status: 'denied',
        error: 'Rate limit exceeded'
      });
      return CommandResponse.denied('Rate limit exceeded. Please wait a moment before sending more commands.');
    }

    // 4. Pending Conversation & Confirmation Interception
    const pendingState = this.contextManager.getPending(request);
    if (pendingState) {
      return this.handlePendingResponse(request, pendingState, normalized);
    }

    // Direct Confirmation Check (e.g. user typed 'yes' or 'no')
    const confirmationAnswer = this.confirmationManager.resolveConfirmation(request, normalized);
    if (confirmationAnswer.status === 'confirmed') {
      return this.executeConfirmedOperation(request, confirmationAnswer.operation, confirmationAnswer.exactParams);
    } else if (confirmationAnswer.status === 'denied') {
      return CommandResponse.info('Action cancelled.');
    }

    // 5. Social Greetings / Small Talk Interception
    if (this.messageRouter && this.messageRouter.handleSocialGreeting(request.senderId, normalized)) {
      return CommandResponse.info('Social greeting acknowledged.');
    }

    // 6. Resolve Pronouns ('them', 'it', 'there') from conversation history
    const pronounResolved = this.contextManager.resolvePronouns(normalized, request);

    // 7. NLP Intent Parsing & Spelling Correction
    const parseResult = this.intentParser.parse(pronounResolved, {
      locations: [],
      players: [request.senderId],
      sender: request.senderId,
      botPos: this.ctx.bot && this.ctx.bot.entity ? this.ctx.bot.entity.position : null
    });

    if (parseResult.intents.length === 0) {
      const failureMsg = this.formatParseFailure(parseResult);
      await this.createAudit({
        commandId,
        request,
        normalizedText: normalized,
        parseConfidence: parseResult.confidence,
        allowed: false,
        status: 'error',
        error: 'Unrecognized intent'
      });
      return CommandResponse.error(failureMsg);
    }

    // 8. Command Planning (Multi-operation & sequence graph)
    const plan = await this.commandPlanner.plan(parseResult, { senderId: request.senderId });

    // 9. Handle Ambiguities (e.g. multiple bases found)
    if (plan.ambiguities && plan.ambiguities.length > 0) {
      const amb = plan.ambiguities[0];
      this.contextManager.setPending(request, {
        type: 'ambiguity',
        ambiguity: amb,
        partialPlan: plan,
        parseResult
      });
      return CommandResponse.clarification(amb.prompt, amb.options);
    }

    // 10. Multi-Operation Authorization Check
    const authResult = await this.authorizePlan(request, plan);
    if (!authResult.allowed) {
      this.permissions.recordFailedAttempt(request.senderId);
      await this.createAudit({
        commandId,
        request,
        normalizedText: normalized,
        parseConfidence: parseResult.confidence,
        allowed: false,
        status: 'denied',
        error: authResult.reason
      });
      return CommandResponse.denied(authResult.reason);
    }

    // 11. Confirmation Requirement Check for Dangerous Operations
    for (const op of plan.operations) {
      if (op.dangerous) {
        const confRecord = this.confirmationManager.requestConfirmation(
          request,
          op,
          op.params,
          `⚠️ WARNING: Dangerous operation requested [${op.intentName}]. Reply 'yes' to proceed or 'no' to cancel within 60s.`
        );
        this.contextManager.setPending(request, {
          type: 'confirmation',
          confirmationId: confRecord.confirmationId,
          operation: op
        });
        return CommandResponse.confirmationRequired(
          confRecord.promptMessage,
          confRecord.confirmationId,
          op
        );
      }
    }

    // 12. Execution & TaskManager Dispatch
    return this.enqueuePlan(request, plan, parseResult);
  }

  /**
   * Dispatches planned operations into TaskManager or immediate control execution.
   * @param {Object} request
   * @param {Object} plan
   * @param {Object} parseResult
   * @returns {Promise<CommandResponse>}
   */
  async enqueuePlan(request, plan, parseResult) {
    const taskIds = [];

    for (const op of plan.operations) {
      // Direct Control Operation
      if (op.isControl) {
        const controlRes = await this.executeControlOperation(request, op);
        await this.createAudit({
          commandId: request.commandId,
          request,
          normalizedText: parseResult.normalizedText,
          parseConfidence: parseResult.confidence,
          allowed: true,
          status: 'success',
          operations: plan.operations
        });
        return controlRes;
      }

      // Macro Expansion
      if (op.intentName === 'run_macro') {
        return this.executeMacro(request, op.params.name);
      }

      // Enqueue as TaskManager Task
      const task = this.taskManager.addTask(
        op.skillName,
        op.params,
        op.priority || Priorities.AUTONOMOUS,
        request.senderId,
        op.locks || ['movement', 'inventory']
      );

      taskIds.push(task.id);
      this.contextManager.rememberTask(request, task);
    }

    this.contextManager.rememberInteraction(request, {
      text: parseResult.normalizedText,
      intent: plan.operations.map((o) => o.intentName).join(' -> '),
      entities: parseResult.entities
    });

    const isSequence = plan.operations.length > 1;
    const msg = isSequence
      ? `Queued workflow (${plan.operations.length} steps): ${plan.operations.map((o) => o.intentName).join(' ➔ ')}.`
      : `Queued task [${plan.operations[0].intentName}]: ${JSON.stringify(plan.operations[0].params)}`;

    await this.createAudit({
      commandId: request.commandId,
      request,
      normalizedText: parseResult.normalizedText,
      parseConfidence: parseResult.confidence,
      allowed: true,
      status: 'queued',
      operations: plan.operations,
      taskIds
    });

    return CommandResponse.queued(msg, taskIds);
  }

  /**
   * Evaluates role permissions across every operation in a compound plan.
   * @param {Object} request
   * @param {Object} plan
   * @returns {Promise<{ allowed: boolean, reason?: string }>}
   */
  async authorizePlan(request, plan) {
    if (!this.permissions) return { allowed: true };

    for (const op of plan.operations) {
      const allowed = await this.permissions.hasPermission(request.senderId, op.requiredPermission);
      if (!allowed) {
        return {
          allowed: false,
          reason: `Access Denied: Operation '${op.intentName}' requires '${op.requiredPermission.toUpperCase()}' role tier.`
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Handles user answers to outstanding pending clarifications or ambiguity challenges.
   * @param {Object} request
   * @param {Object} pending
   * @param {string} answer
   * @returns {Promise<CommandResponse>}
   */
  async handlePendingResponse(request, pending, answer) {
    this.contextManager.clearPending(request);

    if (pending.type === 'ambiguity') {
      const selected = this.contextManager.resolveSelection(answer, pending.ambiguity.options);
      if (!selected) {
        return CommandResponse.error(`Option not recognized. Clarification cancelled.`);
      }

      // Re-apply selected entity and resume plan execution
      if (pending.ambiguity.type === 'location') {
        const resumeText = `go to ${selected.name || selected.label}`;
        return this.execute({
          ...request,
          message: resumeText
        });
      }
    }

    if (pending.type === 'confirmation') {
      const confRes = this.confirmationManager.resolveConfirmation(request, answer);
      if (confRes.status === 'confirmed') {
        return this.executeConfirmedOperation(request, confRes.operation, confRes.exactParams);
      }
      return CommandResponse.info('Operation cancelled.');
    }

    return CommandResponse.info('Clarification resolved.');
  }

  /**
   * Executes a dangerous operation after explicit confirmation was granted.
   * @param {Object} request
   * @param {Object} op
   * @param {Object} params
   * @returns {Promise<CommandResponse>}
   */
  async executeConfirmedOperation(request, op, params) {
    if (op.intentName === 'drop_all') {
      if (this.ctx.inv) {
        await this.ctx.inv.dropLowValueItems({}, 36);
        return CommandResponse.success('Dropped items as confirmed.');
      }
    }

    if (op.intentName === 'revoke_permission') {
      if (this.permissions) {
        await this.permissions.revoke(params.player, request.senderId);
        return CommandResponse.success(`Revoked all permissions for ${params.player}.`);
      }
    }

    if (op.intentName === 'delete_macro') {
      await Macro.deleteOne({ name: params.name });
      return CommandResponse.success(`Deleted macro '${params.name}'.`);
    }

    return CommandResponse.success(`Confirmed operation [${op.intentName}] executed.`);
  }

  /**
   * Executes immediate control tasks (status, help, stop, pause, resume, etc.)
   * @param {Object} request
   * @param {Object} op
   * @returns {Promise<CommandResponse>}
   */
  async executeControlOperation(request, op) {
    switch (op.intentName) {
      case 'status':
        return CommandResponse.info(
          `Status: Health=${Math.round(this.ctx.bot.health || 20)}/20, Food=${Math.round(this.ctx.bot.food || 20)}/20, Pos=(${this.ctx.bot.entity ? Math.round(this.ctx.bot.entity.position.x) : '?'}, ${this.ctx.bot.entity ? Math.round(this.ctx.bot.entity.position.y) : '?'}, ${this.ctx.bot.entity ? Math.round(this.ctx.bot.entity.position.z) : '?'}), Task=${this.taskManager.activeTask ? this.taskManager.activeTask.skillName : 'Idle'}`
        );

      case 'where_are_you':
      case 'coords':
        if (this.ctx.bot && this.ctx.bot.entity) {
          const p = this.ctx.bot.entity.position;
          return CommandResponse.info(
            `Coordinates: X=${Math.round(p.x)}, Y=${Math.round(p.y)}, Z=${Math.round(p.z)} in ${this.ctx.bot.game ? this.ctx.bot.game.dimension : 'overworld'}.`
          );
        }
        return CommandResponse.info('Position currently undetermined.');

      case 'health_status':
        return CommandResponse.info(
          `Health: ${Math.round(this.ctx.bot.health || 20)}/20, Food: ${Math.round(this.ctx.bot.food || 20)}/20.`
        );

      case 'uptime':
        return CommandResponse.info(
          `Uptime: ${Math.round(process.uptime())}s. Host: ${process.env.MC_HOST || 'server'}:${process.env.MC_PORT || '25565'}.`
        );

      case 'help':
        return CommandResponse.info(
          'Available commands: follow me, stop, guard, coords, status, inventory, mine <ore>, farm <crop>, go to <location>, sort.'
        );

      case 'stop':
      case 'pause':
        if (this.ctx.nav) this.ctx.nav.stopFollowing();
        this.taskManager.cancelAll(request.senderId);
        return CommandResponse.success('Tasks stopped and bot is idling.');

      case 'stop_following':
        if (this.ctx.nav) this.ctx.nav.stopFollowing();
        return CommandResponse.success('Stopped following.');

      case 'resume':
        this.taskManager.resume();
        return CommandResponse.success('Task execution resumed.');

      case 'stop_all':
        this.taskManager.cancelAll(request.senderId);
        if (this.ctx.nav) this.ctx.nav.stopFollowing();
        return CommandResponse.success('EMERGENCY STOP: All tasks cancelled.');

      case 'show_inventory':
        if (this.ctx.inv) {
          const invStatus = this.ctx.inv.getStatus();
          return CommandResponse.info(`Inventory: ${invStatus.usedSlots}/${invStatus.totalSlots} slots used.`);
        }
        break;

      case 'grant_permission':
        if (this.permissions) {
          await this.permissions.grant(op.params.player, op.params.role, request.senderId, op.params.durationMs);
          return CommandResponse.success(
            `Granted role '${op.params.role}' to ${op.params.player}${op.params.durationMs ? ` (Expires in ${Math.round(op.params.durationMs / 60000)}m)` : ''}`
          );
        }
        break;

      case 'create_macro':
        {
          const macroDoc = await Macro.findOneAndUpdate(
            { name: op.params.name },
            {
              $set: {
                name: op.params.name,
                owner: request.senderId,
                steps: op.params.steps.split(',').map((s) => s.trim()),
                updatedAt: new Date()
              }
            },
            { upsert: true, new: true }
          );
          return CommandResponse.success(`Macro '${op.params.name}' created with ${macroDoc.steps.length} steps.`);
        }

      case 'list_macros':
        {
          const macros = await Macro.find({}).sort({ name: 1 });
          const list = macros.map((m) => m.name).join(', ') || 'None';
          return CommandResponse.info(`Registered macros: [${list}]`);
        }

      case 'find_item':
        if (this.ctx && this.ctx.logistics) {
          const item = op.params.item;
          const matches = this.ctx.logistics.findItemInWarehouse(item);
          if (matches.length === 0) {
            return CommandResponse.info(`Item '${item}' not found in any indexed warehouse chests.`);
          }
          const topMatch = matches[0];
          const totalFound = matches.reduce((acc, m) => acc + m.count, 0);
          return CommandResponse.success(
            `Found ${totalFound}x ${item} in warehouse! Top location: ${topMatch.count}x in '${topMatch.label}' at (${topMatch.position.x}, ${topMatch.position.y}, ${topMatch.position.z}).`,
            { item, matches }
          );
        }
        return CommandResponse.success(`Located item '${op.params.item}'.`);

      case 'ambient_mode':
        if (this.ctx && this.ctx.ambient) {
          const newState = await this.ctx.ambient.toggle(op.params.enabled);
          return CommandResponse.success(`Autonomous ambient homestead behaviors are now ${newState ? 'ENABLED' : 'DISABLED'}.`);
        }
        return CommandResponse.success('Ambient mode updated.');

      case 'sleep':
        if (this.ctx && this.ctx.ambient) {
          const slept = await this.ctx.ambient.checkSleepRoutine();
          if (!slept) {
            return CommandResponse.info('Could not find a safe bed nearby to sleep in.');
          }
          return CommandResponse.success('Resting in bed to safely skip the night...');
        }
        return CommandResponse.success('Sleep command processed.');

      case 'wake':
        if (this.ctx && this.ctx.ambient) {
          await this.ctx.ambient.wake();
          return CommandResponse.success('Woke up from bed.');
        }
        return CommandResponse.success('Wake command processed.');

      default:
        break;
    }

    return CommandResponse.success(`Control operation '${op.intentName}' executed.`);
  }

  /**
   * Expands and executes a stored macro sequence with individual step re-authorization.
   * @param {Object} request
   * @param {string} macroName
   * @returns {Promise<CommandResponse>}
   */
  async executeMacro(request, macroName) {
    const macro = await Macro.findOne({ name: macroName.toLowerCase() });
    if (!macro) {
      return CommandResponse.error(`Macro '${macroName}' not found.`);
    }

    const compoundCommand = macro.steps.join(' then ');
    return this.execute({
      ...request,
      message: compoundCommand
    });
  }

  /**
   * Formats a user-friendly suggestion on parse failures.
   * @param {Object} parseResult
   * @returns {string}
   */
  formatParseFailure(parseResult) {
    if (parseResult.suggestedCorrections && parseResult.suggestedCorrections.length > 0) {
      const top = parseResult.suggestedCorrections[0];
      return `Did you mean "${top.to}"?`;
    }
    return `Command not understood. Type "help" to view available skills and syntax.`;
  }

  /**
   * Records forensic command audit to MongoDB and persistent storage.
   * @param {Object} data
   */
  async createAudit(data) {
    const entry = {
      commandId: data.commandId,
      source: data.request.source,
      senderId: data.request.senderId,
      senderDisplayName: data.request.senderDisplayName || data.request.senderId,
      sessionId: data.request.sessionId || null,
      rawText: data.request.message || '',
      normalizedText: data.normalizedText || '',
      parseConfidence: data.parseConfidence || 0,
      corrections: data.corrections || [],
      plannedOperations: data.operations || [],
      authorizationResult: data.allowed !== false,
      finalStatus: data.status || 'unknown',
      taskIds: data.taskIds || [],
      errorDetail: data.error || null,
      timestamp: new Date()
    };

    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        await CommandAudit.create(entry);
      }
    } catch (err) {
      // Non-fatal if Mongo is offline
    }

    eventBus.emit('command.audit', entry);
  }
}

module.exports = UnifiedCommandGateway;
