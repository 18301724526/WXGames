const test = require('node:test');
const assert = require('node:assert/strict');

const EcsCoreBoundary = require('./EcsCoreBoundary');

test('EcsCoreBoundary exposes only the approved Batch 2 primitive surface', () => {
  assert.deepEqual(Object.keys(EcsCoreBoundary).sort(), [
    'Types',
    'addComponent',
    'addEntity',
    'createWorld',
    'defineComponent',
    'defineQuery',
    'enterQuery',
    'exitQuery',
    'hasComponent',
    'pipe',
    'removeComponent',
    'removeEntity',
  ]);
});

test('EcsCoreBoundary forwards bitecs primitives without creating a local core', () => {
  const Position = EcsCoreBoundary.defineComponent({
    x: EcsCoreBoundary.Types.f32,
    y: EcsCoreBoundary.Types.f32,
  });
  const query = EcsCoreBoundary.defineQuery([Position]);
  const enterQuery = EcsCoreBoundary.enterQuery(query);
  const exitQuery = EcsCoreBoundary.exitQuery(query);
  const world = EcsCoreBoundary.createWorld();
  const entity = EcsCoreBoundary.addEntity(world);

  assert.equal(EcsCoreBoundary.hasComponent(world, Position, entity), false);

  EcsCoreBoundary.addComponent(world, Position, entity);
  Position.x[entity] = 12;
  Position.y[entity] = 34;

  assert.equal(EcsCoreBoundary.hasComponent(world, Position, entity), true);
  assert.deepEqual(Array.from(query(world)), [entity]);
  assert.equal(typeof enterQuery, 'function');

  EcsCoreBoundary.removeComponent(world, Position, entity);

  assert.equal(EcsCoreBoundary.hasComponent(world, Position, entity), false);
  assert.deepEqual(Array.from(query(world)), []);
  assert.equal(typeof exitQuery, 'function');
});

test('EcsCoreBoundary keeps system composition delegated to bitecs pipe', () => {
  const system = EcsCoreBoundary.pipe(
    (world) => ({ ...world, first: true }),
    (world) => ({ ...world, second: true }),
  );

  assert.deepEqual(system({}), { first: true, second: true });
});
