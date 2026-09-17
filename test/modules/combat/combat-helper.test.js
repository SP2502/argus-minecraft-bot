const test = require('node:test');
const assert = require('node:assert');
const { CombatService: CombatHelperService } = require('../../../src/modules/combat');

test('CombatHelperService - Threat Scoring and Entity Prioritization', () => {
  const mockBot = {
    entity: { position: { x: 0, y: 64, z: 0 } },
    inventory: { items: () => [], slots: {} }
  };

  const helper = new CombatHelperService(mockBot);

  const creeperClose = {
    name: 'creeper',
    position: { x: 3, y: 64, z: 0 },
    type: 'mob'
  };

  const zombieFar = {
    name: 'zombie',
    position: { x: 25, y: 64, z: 0 },
    type: 'mob'
  };

  const sheepPassive = {
    name: 'sheep',
    position: { x: 2, y: 64, z: 0 },
    type: 'mob'
  };

  const creeperScore = helper.threatScore(creeperClose);
  const zombieScore = helper.threatScore(zombieFar);
  const sheepScore = helper.threatScore(sheepPassive);

  assert.ok(creeperScore >= 95, `Expected close creeper threat >= 95, got ${creeperScore}`);
  assert.ok(zombieScore < creeperScore, `Expected zombie score (${zombieScore}) < creeper score (${creeperScore})`);
  assert.strictEqual(sheepScore, 0, 'Passive sheep should have threat score of 0');
});

test('CombatHelperService - Weapon Selection and Enchantment Weighting', () => {
  const items = [
    { name: 'iron_sword', count: 1 },
    { name: 'diamond_sword', count: 1 },
    {
      name: 'iron_sword',
      count: 1,
      nbt: {
        value: {
          Enchantments: {
            value: {
              value: [
                { id: { value: 'minecraft:sharpness' }, lvl: { value: 5 } }
              ]
            }
          }
        }
      }
    }
  ];

  const mockBot = {
    inventory: {
      items: () => items,
      slots: {}
    }
  };

  const helper = new CombatHelperService(mockBot);
  const bestWeapon = helper.pickBestWeapon();

  // Sharpness V Iron Sword (6 + 5*1.25 = 12.25) beats vanilla Diamond Sword (7)
  assert.strictEqual(bestWeapon.name, 'iron_sword');
  assert.ok(bestWeapon.nbt !== undefined);
});

test('CombatHelperService - Ally and Whitelist Protection', () => {
  const mockBot = { inventory: { items: () => [], slots: {} } };
  const helper = new CombatHelperService(mockBot);
  helper.setWhitelist(['TrustedAlly', 'OwnerPlayer']);

  const allyPlayer = { type: 'player', username: 'TrustedAlly' };
  const hostilePlayer = { type: 'player', username: 'GrieferEnemy' };
  const villager = { name: 'villager', type: 'mob' };
  const zombie = { name: 'zombie', type: 'mob' };

  assert.strictEqual(helper.isAlly(allyPlayer), true);
  assert.strictEqual(helper.isAlly(hostilePlayer), false);
  assert.strictEqual(helper.isAlly(villager), true);
  assert.strictEqual(helper.isAlly(zombie), false);
});
