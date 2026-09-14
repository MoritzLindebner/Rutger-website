const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spherePoints, dimensions, collisionPairs, rotate, covers } = require('./_songs-sphere.js');

function dot(a, b) { return a.reduce((sum, value, i) => sum + value * b[i], 0); }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function rectangle(point, geometry) {
  const { latitude: lat, longitude: lon } = point;
  const normal = [point.x, point.y, point.z];
  const right = [Math.cos(lon), 0, -Math.sin(lon)];
  const up = [-Math.sin(lon) * Math.sin(lat), Math.cos(lat), -Math.cos(lon) * Math.sin(lat)];
  return { normal, right, up, corners: [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, y]) => normal.map((value, i) => value * geometry.radius + (right[i] * x + up[i] * y) * geometry.card / 2)) };
}
function intersects(a, b) {
  const axes = [a.normal, b.normal, ...[a.right, a.up].flatMap(u => [b.right, b.up].map(v => cross(u, v)))];
  return !axes.some(axis => {
    if (Math.hypot(...axis) < 1e-10) return false;
    const pa = a.corners.map(p => dot(p, axis));
    const pb = b.corners.map(p => dot(p, axis));
    return Math.max(...pa) < Math.min(...pb) - 1e-8 || Math.max(...pb) < Math.min(...pa) - 1e-8;
  });
}

test('13 distinct local covers exist; doubled layout repeats the same catalog', () => {
  assert.equal(covers.length, 13);
  assert.equal(new Set(covers.map(([file]) => file)).size, 13);
  for (const [file] of covers) assert.ok(fs.statSync(path.join(__dirname, 'covers', file)).size > 0);
});

test('each duplicate is exactly opposite its original cover', () => {
  const points = spherePoints(26);
  for (let index = 0; index < covers.length; index++) {
    const original = points[index];
    const duplicate = points[index + covers.length];
    assert.ok(Math.hypot(original.x + duplicate.x, original.y + duplicate.y, original.z + duplicate.z) < 1e-12);
    const distance = Math.hypot(original.x - duplicate.x, original.y - duplicate.y, original.z - duplicate.z);
    assert.ok(Math.abs(distance - 2) < 1e-12, 'duplicates must be a full diameter apart');
  }
  const minimumSpacing = Math.min(...points.flatMap((point, index) => points.slice(index + 1).map(other => Math.hypot(point.x - other.x, point.y - other.y, point.z - other.z))));
  assert.ok(minimumSpacing > .4, 'different covers must remain distributed without clusters');
});

test('changing the catalog size keeps the requested cover size', () => {
  const initial = dimensions(1000, 800, 13, .20).card;
  for (const count of [8, 13, 23, 26, 33, 43, 53, 64]) {
    assert.equal(dimensions(1000, 800, count, .20).card, initial);
    assert.equal(spherePoints(count).length, count);
    assert.ok(spherePoints(count).every(p => Math.abs(Math.hypot(p.x, p.y, p.z) - 1) < 1e-12));
  }
});

test('repeated vertical and horizontal swipes keep rotating past the poles', () => {
  for (const [dx, dy, axis] of [[0, 100, 'x'], [100, 0, 'y']]) {
    let angle = { x: 0, y: 0 };
    for (let swipe = 0; swipe < 30; swipe++) {
      const previous = angle[axis];
      angle = rotate(angle.x, angle.y, dx, dy, 320);
      assert.notEqual(angle[axis], previous, `swipe ${swipe + 1} must still rotate ${axis}`);
      assert.ok(Number.isFinite(angle[axis]));
    }
  }
});

test('density warning agrees with independent framed-surface checks', () => {
  for (const count of [8, 13, 23, 26, 33, 43, 53, 64]) {
    for (const scale of [.14, .20, .28, .30]) {
      const geometry = dimensions(1000, 1000, count, scale);
      const cards = spherePoints(count).map(point => rectangle(point, geometry));
      const expected = [];
      for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) {
        if (intersects(cards[i], cards[j])) expected.push([i, j]);
      }
      assert.deepEqual(collisionPairs(count, scale), expected);
      const outerRadius = Math.hypot(geometry.radius, geometry.card / Math.sqrt(2));
      assert.ok(2 * outerRadius * geometry.perspective / (geometry.perspective - outerRadius) < 1000);
    }
  }
  assert.equal(collisionPairs(26, .20).length, 0);
  assert.ok(collisionPairs(64, .30).length > 0, 'an overloaded experiment must report collisions');
});

for (const count of [13, 26]) {
  test(`${count} framed card surfaces never intersect in 3D`, () => {
    const geometry = dimensions(1000, 1000, count);
    // Inflated frames require a visible gap, not merely touching edges.
    geometry.card *= 1.04;
    const rectangles = spherePoints(count).map(point => rectangle(point, geometry));
    const collisions = [];
    for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) {
      if (intersects(rectangles[i], rectangles[j])) collisions.push(`${covers[i % 13][1]} / ${covers[j % 13][1]}`);
    }
    assert.deepEqual(collisions, []);
  });
  test(`${count} cards remain on a fixed sphere under repeated dragging`, () => {
    const points = spherePoints(count);
    let rotation = { x: -12, y: 22 };
    for (let step = 0; step < 100; step++) {
      rotation = rotate(rotation.x, rotation.y, Math.sin(step) * 300, Math.cos(step) * 200, 300);
      const xAngle = rotation.x * Math.PI / 180;
      const yAngle = rotation.y * Math.PI / 180;
      for (const p of points) {
        const x = p.x * Math.cos(yAngle) + p.z * Math.sin(yAngle);
        const z = -p.x * Math.sin(yAngle) + p.z * Math.cos(yAngle);
        const y = p.y * Math.cos(xAngle) - z * Math.sin(xAngle);
        const zz = p.y * Math.sin(xAngle) + z * Math.cos(xAngle);
        assert.ok(Math.abs(Math.hypot(x, y, zz) - 1) < 1e-12);
      }
      assert.ok(Number.isFinite(rotation.x) && Number.isFinite(rotation.y));
    }
    assert.equal(points.length, count);
  });

  test(`${count} cards fit at every rotation, including portrait and short landscape`, () => {
    for (const [width, height] of [[288, 420], [343, 600], [704, 800], [944, 600], [1344, 740], [1824, 900], [2464, 1200], [780, 275]]) {
      const g = dimensions(width, height, count);
      // Each tangent card corner lies on this outer sphere. Its maximum
      // perspective projection is a conservative bound for any rotation.
      const outerRadius = Math.hypot(g.radius, g.card / Math.sqrt(2));
      const projectedRadius = outerRadius * g.perspective / (g.perspective - outerRadius);
      assert.ok(projectedRadius * 2 < Math.min(width, height), `${width}x${height}`);
    }
  });
}
