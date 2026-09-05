const test = require('node:test');
const assert = require('node:assert');
const AmbientBehaviorService = require('../services/AmbientBehaviorService');

test('AmbientBehaviorService - Day/Night and Weather Detection', () => {
  // 1. Daytime (6000 ticks) and clear
  const dayBot = {
    time: { timeOfDay: 6000 },
    isRaining: false,
    thunderState: 0
  };
  const serviceDay = new AmbientBehaviorService(dayBot, null);
  assert.strictEqual(serviceDay.isNightOrStorm(), false);

  // 2. Nighttime (18000 ticks)
  const nightBot = {
    time: { timeOfDay: 18000 },
    isRaining: false,
    thunderState: 0
  };
  const serviceNight = new AmbientBehaviorService(nightBot, null);
  assert.strictEqual(serviceNight.isNightOrStorm(), true);

  // 3. Daytime but active Thunderstorm
  const stormBot = {
    time: { timeOfDay: 6000 },
    isRaining: true,
    thunderState: 1
  };
  const serviceStorm = new AmbientBehaviorService(stormBot, null);
  assert.strictEqual(serviceStorm.isNightOrStorm(), true);
});

test('AmbientBehaviorService - Bed Sleeping Routine and Wake Cycle', async () => {
  let navCalled = false;
  let sleepCalled = false;
  let wakeCalled = false;
  const eventsEmitted = [];

  const mockBed = {
    name: 'red_bed',
    position: { x: 12, y: 64, z: 12 }
  };

  const mockBot = {
    time: { timeOfDay: 15000 },
    sleep: async (bedBlock) => {
      sleepCalled = true;
    },
    wake: async () => {
      wakeCalled = true;
    },
    on: () => {}
  };

  const mockCtx = {
    target: {
      findNearestBlock: (names) => {
        if (names.includes('red_bed')) return mockBed;
        return null;
      }
    },
    nav: {
      goTo: async () => {
        navCalled = true;
        return true;
      }
    },
    events: {
      emit: (evt, data) => eventsEmitted.push({ evt, data })
    },
    messageRouter: {
      send: async () => {}
    }
  };

  const service = new AmbientBehaviorService(mockBot, mockCtx);

  // 1. Sleep in bed at night
  const slept = await service.checkSleepRoutine();
  assert.strictEqual(slept, true);
  assert.strictEqual(navCalled, true);
  assert.strictEqual(sleepCalled, true);
  assert.strictEqual(service.isSleeping, true);
  assert.strictEqual(service.stats.timesSlept, 1);

  // 2. Wake up from bed
  await service.wake();
  assert.strictEqual(wakeCalled, true);
  assert.strictEqual(service.isSleeping, false);
  assert.strictEqual(service.currentBed, null);

  const sleepEvent = eventsEmitted.find((e) => e.evt === 'ambient.sleep');
  const wakeEvent = eventsEmitted.find((e) => e.evt === 'ambient.wake');
  assert.ok(sleepEvent);
  assert.ok(wakeEvent);
});

test('AmbientBehaviorService - Autonomous Hunger Recovery (Auto-Eat)', async () => {
  let equipCalled = false;
  let consumeCalled = false;
  const eventsEmitted = [];

  const inventoryItems = [
    { name: 'bread', type: 100, count: 5 }
  ];

  const mockBot = {
    food: 10, // Hungry (<14 threshold)
    inventory: {
      items: () => inventoryItems
    },
    equip: async (item, hand) => {
      equipCalled = true;
    },
    consume: async () => {
      consumeCalled = true;
      mockBot.food = 15;
    }
  };

  const mockCtx = {
    actionQueue: {
      enqueue: async (fn) => fn()
    },
    events: {
      emit: (evt, data) => eventsEmitted.push({ evt, data })
    }
  };

  const service = new AmbientBehaviorService(mockBot, mockCtx);
  const ate = await service.checkAutoEat();

  assert.strictEqual(ate, true);
  assert.strictEqual(equipCalled, true);
  assert.strictEqual(consumeCalled, true);
  assert.strictEqual(service.stats.itemsEaten, 1);

  const ateEvent = eventsEmitted.find((e) => e.evt === 'ambient.ate');
  assert.ok(ateEvent);
  assert.strictEqual(ateEvent.data.food, 'bread');
});

test('AmbientBehaviorService - Idle Maintenance Job Dispatching', async () => {
  const queuedTasks = [];

  const mockBot = {};
  const mockCtx = {
    inv: {
      // 30 of 36 slots used = 83% (>75% threshold)
      countUsedSlots: () => 30
    },
    target: {
      findNearestBlock: () => null
    },
    taskManager: {
      addTask: (skill, params, priority, sender, locks) => {
        queuedTasks.push({ skill, params, priority, sender, locks });
        return { id: 'ambient_task_1' };
      }
    }
  };

  const service = new AmbientBehaviorService(mockBot, mockCtx);
  const triggered = await service.checkMaintenanceRoutine();

  assert.strictEqual(triggered, true);
  assert.strictEqual(queuedTasks.length, 1);
  assert.strictEqual(queuedTasks[0].skill, 'logistics');
  assert.strictEqual(queuedTasks[0].params.mode, 'sort');
  assert.strictEqual(queuedTasks[0].priority, 20); // Priorities.BACKGROUND
  assert.strictEqual(service.stats.maintenanceRuns, 1);
});

test('AmbientBehaviorService - Toggle Active Status', async () => {
  let wakeCalled = false;
  const mockBot = {
    isSleeping: true,
    wake: async () => { wakeCalled = true; }
  };
  const eventsEmitted = [];
  const mockCtx = {
    events: {
      emit: (evt, data) => eventsEmitted.push({ evt, data })
    }
  };

  const service = new AmbientBehaviorService(mockBot, mockCtx);
  service.isSleeping = true;

  // Toggle OFF
  const stateOff = await service.toggle(false);
  assert.strictEqual(stateOff, false);
  assert.strictEqual(service.enabled, false);
  assert.strictEqual(wakeCalled, true);

  // Toggle ON
  const stateOn = await service.toggle(true);
  assert.strictEqual(stateOn, true);
  assert.strictEqual(service.enabled, true);
});
