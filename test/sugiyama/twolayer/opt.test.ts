import { createLayers, crossings } from "../utils";

import { opt } from "../../../src/sugiyama/twolayer/opt";

test("opt() allows setting options", () => {
  const layering = opt().large("large").dist(true);
  expect(layering.large()).toEqual("large");
  expect(layering.dist()).toBeTruthy();
});

test("opt() works for very simple case", () => {
  // independent links that need to be swapped
  const [topLayer, bottomLayer] = createLayers([[[1], [0]]]);
  opt()(topLayer, bottomLayer, true);
  const inds = bottomLayer.map((n) => n.data?.index);
  expect(inds).toEqual([1, 0]);
});

test("opt() works for very simple case bottom-up", () => {
  // independent links that need to be swapped
  const [topLayer, bottomLayer] = createLayers([[[1], [0]]]);
  opt()(topLayer, bottomLayer, false);
  const inds = topLayer.map((n) => n.data?.index);
  expect(inds).toEqual([1, 0]);
});

test("opt() works where mean fails", () => {
  const [topLayer, bottomLayer] = createLayers([
    [[4], [4], [0], [1], [2], [3], [4]]
  ]);
  bottomLayer.reverse();
  opt()(topLayer, bottomLayer, true);
  expect(crossings([topLayer, bottomLayer])).toBeCloseTo(4);
  const inds = bottomLayer.map((n) => n.data?.index);
  expect(inds).toEqual([4, 0, 1, 2, 3]);
});

test("opt() works where median is suboptimal", () => {
  const [topLayer, bottomLayer] = createLayers([
    [[3], [2], [2], [0], [1], [3], [2]]
  ]);
  opt()(topLayer, bottomLayer, true);
  expect(crossings([topLayer, bottomLayer])).toBeCloseTo(6);
  const inds = bottomLayer.map((n) => n.data?.index);
  expect(inds).toEqual([3, 2, 0, 1]);
});

test("opt() works where median is suboptimal bottom-up", () => {
  const [topLayer, bottomLayer] = createLayers([[[3], [4], [1, 2, 6], [0, 5]]]);
  opt()(topLayer, bottomLayer, false);
  expect(crossings([topLayer, bottomLayer])).toBeCloseTo(6);
  const inds = topLayer.map((n) => n.data?.index);
  expect(inds).toEqual([3, 2, 0, 1]);
});

test("opt() preserves order of easy unconstrained nodes", () => {
  const [topLayer, bottomLayer] = createLayers([[[0], [2]]]);
  opt()(topLayer, bottomLayer, true);
  const inds = bottomLayer.map((n) => n.data?.index);
  expect(inds).toEqual([0, 1, 2]);
});

test("opt() preserves order of easy unconstrained nodes bottom-up", () => {
  const [topLayer, bottomLayer] = createLayers([[[0], [], [1]]]);
  opt()(topLayer, bottomLayer, false);
  const inds = topLayer.map((n) => n.data?.index);
  expect(inds).toEqual([0, 1, 2]);
});

test("opt() preserves order of multiple easy unconstrained nodes", () => {
  const [topLayer, bottomLayer] = createLayers([[[0], [3]]]);
  opt()(topLayer, bottomLayer, true);
  const inds = bottomLayer.map((n) => n.data?.index);
  expect(inds).toEqual([0, 1, 2, 3]);
});

test("opt() preserves order of unconstrained nodes to front", () => {
  const [topLayer, bottomLayer] = createLayers([[[3], [2], [0]]]);
  opt()(topLayer, bottomLayer, true);
  const inds = bottomLayer.map((n) => n.data?.index);
  expect(inds).toEqual([1, 3, 2, 0]);
});

test("opt() preserves order of unconstrained nodes to back", () => {
  const [topLayer, bottomLayer] = createLayers([[[3], [1], [0]]]);
  opt()(topLayer, bottomLayer, true);
  const inds = bottomLayer.map((n) => n.data?.index);
  expect(inds).toEqual([3, 1, 0, 2]);
});

test("opt() doesn't optimize for distance", () => {
  const [topLayer, bottomLayer] = createLayers([[[0, 2]]]);
  opt()(topLayer, bottomLayer, true);
  const inds = bottomLayer.map((n) => n.data?.index);
  expect(inds).toEqual([0, 1, 2]);
});

test("opt() can optimize for distance", () => {
  const [topLayer, bottomLayer] = createLayers([[[0, 2]]]);
  opt().dist(true)(topLayer, bottomLayer, true);
  const inds = bottomLayer.map((n) => n.data?.index);
  expect(inds).toEqual([0, 2, 1]);
});

test("opt() can optimize for distance bottom-up", () => {
  const [topLayer, bottomLayer] = createLayers([[[0], [], [0]]]);
  opt().dist(true)(topLayer, bottomLayer, false);
  const inds = topLayer.map((n) => n.data?.index);
  expect(inds).toEqual([0, 2, 1]);
});

test("opt() fails for large inputs", () => {
  const [topLayer, bottomLayer] = createLayers([[[...Array(51).keys()]]]);
  expect(() => opt()(topLayer, bottomLayer, true)).toThrow(`"large"`);
});

test("opt() fails for medium inputs", () => {
  const [topLayer, bottomLayer] = createLayers([[[...Array(31).keys()]]]);
  expect(() => opt()(topLayer, bottomLayer, true)).toThrow(`"medium"`);
});

test("opt() fails passing an arg to constructor", () => {
  // @ts-expect-error opt doesn't take arguments
  expect(() => opt(undefined)).toThrow("got arguments to opt");
});
