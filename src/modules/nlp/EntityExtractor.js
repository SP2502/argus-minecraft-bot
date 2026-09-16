const tokenizer = require('./CommandTokenizer');
const quantityParser = require('./QuantityParser');
const coordinateParser = require('./CoordinateParser');
const timeParser = require('./TimeExpressionParser');
const synonymRegistry = require('./SynonymRegistry');

/**
 * EntityExtractor - Multi-slot entity extraction engine for Minecraft commands.
 */
class EntityExtractor {
  /**
   * Extracts all structured entity slots from natural language text.
   * 
   * @param {string} text - Clean natural language input
   * @param {Object} [context={}] - Contextual metadata (registered locations, online players, botPos)
   * @returns {Object} Extracted entity dictionary
   */
  extract(text = '', context = {}) {
    const clean = text.trim();
    const tokens = tokenizer.tokenize(clean);
    const entities = {
      quantity: null,
      item: null,
      crop: null,
      targetOre: null,
      treeType: null,
      mobType: null,
      fuel: null,
      location: null,
      player: null,
      time: null,
      role: null,
      name: null,
      steps: null,
      kit: null,
      modifiers: {}
    };

    // 1. Modifiers & Flags Extraction
    if (/with(?:out)?\s+bone\s*meal/i.test(clean)) {
      entities.modifiers.useBoneMeal = !/without\s+bone\s*meal/i.test(clean);
    }
    if (/opportunistic(?:ally)?|if you see/i.test(clean)) {
      entities.modifiers.opportunistic = true;
    }
    if (/quietly|silently/i.test(clean)) {
      entities.modifiers.quiet = true;
    }
    if (/safely/i.test(clean)) {
      entities.modifiers.safe = true;
    }

    // 2. Quantity Extraction (e.g. "64", "2 stacks", "a dozen", "all")
    for (let i = 0; i < tokens.length; i++) {
      // Check 2-token quantities like "2 stacks", "half stack", "a dozen"
      if (i + 1 < tokens.length) {
        const pair = `${tokens[i].normalized} ${tokens[i + 1].normalized}`;
        const qPair = quantityParser.parse(pair);
        if (qPair.value !== null || qPair.mode === 'all') {
          entities.quantity = qPair;
          break;
        }
      }
      // Check single token quantities
      const qSingle = quantityParser.parse(tokens[i].normalized);
      if (qSingle.value !== null || qSingle.mode === 'all') {
        entities.quantity = qSingle;
        break;
      }
    }

    // 3. Coordinate & Location Extraction
    const coordEntity = coordinateParser.parse(clean, context.botPos || null);
    if (coordEntity) {
      entities.location = coordEntity;
    } else {
      // Check for named locations (e.g. "main base", "iron mine", "wheat farm")
      const locRegex = /(?:to|at|in|near)\s+([a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)?)/i;
      const locMatch = clean.match(locRegex);
      if (locMatch) {
        const locName = locMatch[1].trim();
        // Exclude common items/verbs from matching as location
        if (!synonymRegistry.itemAliases[locName] && !['the', 'my', 'your', 'some'].includes(locName)) {
          entities.location = {
            type: 'named_location',
            name: locName,
            canonical: synonymRegistry.resolveLocation(locName)
          };
        }
      }
    }

    // 4. Time & Duration Extraction
    const timeEntity = timeParser.parse(clean);
    if (timeEntity) {
      entities.time = timeEntity;
    }

    // 5. Item / Ore / Crop Extraction
    for (const t of tokens) {
      const term = t.normalized;
      if (synonymRegistry.itemAliases[term]) {
        const canonical = synonymRegistry.resolveItem(term);
        entities.item = canonical;

        // Specific ore vs crop slot assignment
        if (['diamond', 'iron_ingot', 'iron_ore', 'gold_ingot', 'gold_ore', 'coal', 'copper_ingot', 'redstone', 'lapis_lazuli', 'emerald', 'netherite_ingot'].includes(canonical)) {
          entities.targetOre = canonical.replace('_ingot', '').replace('_ore', '');
        } else if (['wheat', 'carrot', 'potato', 'beetroot', 'melon', 'pumpkin', 'sugar_cane', 'bamboo', 'nether_wart', 'cocoa_beans'].includes(canonical)) {
          entities.crop = canonical.replace('_beans', '');
        }
        break;
      }
    }

    // 5b. Tree Type Extraction
    for (let i = 0; i < tokens.length; i++) {
      if (i + 1 < tokens.length) {
        const pair = `${tokens[i].normalized}_${tokens[i + 1].normalized}`;
        if (synonymRegistry.treeAliases && synonymRegistry.treeAliases[pair]) {
          entities.treeType = synonymRegistry.resolveTreeType(pair);
          break;
        }
      }
      const single = tokens[i].normalized;
      if (synonymRegistry.treeAliases && synonymRegistry.treeAliases[single]) {
        entities.treeType = synonymRegistry.resolveTreeType(single);
        break;
      }
    }

    // 5c. Mob Type Extraction
    for (let i = 0; i < tokens.length; i++) {
      if (i + 1 < tokens.length) {
        const pair = `${tokens[i].normalized}_${tokens[i + 1].normalized}`;
        if (synonymRegistry.mobAliases && synonymRegistry.mobAliases[pair]) {
          entities.mobType = synonymRegistry.resolveMobType(pair);
          break;
        }
      }
      const single = tokens[i].normalized;
      if (synonymRegistry.mobAliases && synonymRegistry.mobAliases[single]) {
        entities.mobType = synonymRegistry.resolveMobType(single);
        break;
      }
    }

    // 5d. Fuel Extraction
    const fuelMatch = clean.match(/(?:with|using)\s+([a-zA-Z_]+(?:\s+[a-zA-Z_]+)?)/i);
    if (fuelMatch) {
      const candidateFuel = fuelMatch[1].trim().toLowerCase().replace(/\s+/g, '_');
      const fuelOptions = ['coal', 'charcoal', 'lava_bucket', 'oak_log', 'oak_planks', 'stick'];
      if (fuelOptions.includes(candidateFuel) || candidateFuel.includes('coal') || candidateFuel.includes('wood')) {
        entities.fuel = candidateFuel;
      }
    }

    // 5e. Structure, Dimensions & Building Material Extraction
    for (const t of tokens) {
      if (synonymRegistry.structureAliases && synonymRegistry.structureAliases[t.normalized]) {
        entities.structure = synonymRegistry.resolveStructure(t.normalized);
        break;
      }
    }

    const dimMatch = clean.match(/\b(\d+)\s*(?:x|by)\s*(\d+)(?:\s*(?:x|by)\s*(\d+))?\b/i);
    if (dimMatch) {
      entities.dimensions = {
        dim1: parseInt(dimMatch[1], 10),
        dim2: parseInt(dimMatch[2], 10),
        dim3: dimMatch[3] ? parseInt(dimMatch[3], 10) : null
      };
    }

    const matMatch = clean.match(/(?:with|of)\s+([a-zA-Z_]+(?:\s+[a-zA-Z_]+)?)/i);
    if (matMatch) {
      const candidateMat = matMatch[1].trim().toLowerCase().replace(/\s+/g, '_');
      const { buildingData } = require('../building');
      if (buildingData.validBuildingMaterials.includes(candidateMat) || buildingData.materialAliases[candidateMat]) {
        entities.material = buildingData.materialAliases[candidateMat] || candidateMat;
      }
    }

    // 5f. Kit Extraction for Logistics/Restock
    for (const t of tokens) {
      if (synonymRegistry.kitAliases && synonymRegistry.kitAliases[t.normalized]) {
        entities.kit = synonymRegistry.resolveKit(t.normalized);
        break;
      }
    }

    if (!entities.item) {
      const findMatch = clean.match(/(?:find\s+(?:item\s+)?|where\s+is\s+|locate\s+)([a-zA-Z0-9_]+)/i);
      if (findMatch) {
        entities.item = synonymRegistry.resolveItem(findMatch[1].trim().toLowerCase());
      }
    }

    // 6. Player Name Extraction (@PlayerName, player token, or "me")
    if (/\b(?:protect|guard|follow)\s+me\b/i.test(clean)) {
      entities.player = context.sender || 'me';
    } else {
      for (const t of tokens) {
        if (t.token.startsWith('@') && t.token.length > 1) {
          entities.player = t.token.substring(1);
          break;
        }
      }
    }
    if (!entities.player && context.players && Array.isArray(context.players)) {
      for (const p of context.players) {
        if (tokens.some((t) => t.normalized === p.toLowerCase())) {
          entities.player = p;
          break;
        }
      }
    }

    // 7. Role Level Extraction ('owner', 'admin', 'trusted', 'guest', 'blocked')
    for (const t of tokens) {
      const lower = t.normalized;
      if (['owner', 'admin', 'trusted', 'guest', 'blocked', 'member'].includes(lower)) {
        entities.role = lower === 'member' ? 'trusted' : lower;
        break;
      }
    }

    // 8. Macro Definition Colon Splitting ("create macro name: step 1, step 2")
    if (clean.includes(':')) {
      const colonIdx = clean.indexOf(':');
      const prefix = clean.substring(0, colonIdx).trim();
      const body = clean.substring(colonIdx + 1).trim();

      const macroNameMatch = prefix.match(/macro\s+([a-zA-Z0-9_-]+)/i);
      if (macroNameMatch) {
        entities.name = macroNameMatch[1].toLowerCase();
        entities.steps = body;
      }
    }

    return entities;
  }
}

module.exports = new EntityExtractor();
