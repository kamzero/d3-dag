import { SimpleDatum, doub, ex, square } from "../../examples";

import { DagNode } from "../../../src/dag";
import { getLayers } from "../utils";
import { simplex } from "../../../src/sugiyama/layering/simplex";

test("simplex() works for square", () => {
  const dag = square();
  simplex()(dag);
  const layers = getLayers(dag);
  expect([[0], [1, 2], [3]]).toEqual(layers);
});

test("simplex() respects ranks and gets them", () => {
  const dag = square();
  function ranker(node: DagNode<SimpleDatum>): undefined | number {
    if (node.data.id === "1") {
      return 1;
    } else if (node.data.id === "2") {
      return 2;
    } else {
      return undefined;
    }
  }
  const layout = simplex().rank(ranker);
  expect(layout.rank()).toBe(ranker);
  layout(dag);
  const layers = getLayers(dag);
  expect([[0], [1], [2], [3]]).toEqual(layers);
});

test("simplex() works for X", () => {
  // NOTE longest path will always produce a dummy node, where simplex
  // will not
  const dag = ex();
  simplex()(dag);
  const layers = getLayers(dag);
  expect([[0], [1, 2], [3], [4, 5], [6]]).toEqual(layers);
});

test("simplex() respects equality rank", () => {
  const dag = ex();
  const layout = simplex().rank((node: DagNode<SimpleDatum>) =>
    node.data.id === "0" || node.data.id === "2" ? 0 : undefined
  );
  layout(dag);
  const layers = getLayers(dag);
  expect([[0, 2], [1], [3], [4, 5], [6]]).toEqual(layers);
});

test("simplex() respects groups", () => {
  const dag = ex();
  const grp = (node: DagNode<SimpleDatum>) =>
    node.data.id === "0" || node.data.id === "2" ? "group" : undefined;
  const layout = simplex().group(grp);
  expect(layout.group()).toBe(grp);
  layout(dag);
  const layers = getLayers(dag);
  expect([[0, 2], [1], [3], [4, 5], [6]]).toEqual(layers);
});

test("simplex() works for disconnected dag", () => {
  const dag = doub();
  simplex()(dag);
  const layers = getLayers(dag);
  expect([[0, 1]]).toEqual(layers);
});

test("simplex() fails passing an arg to constructor", () => {
  expect(() => simplex(null as never)).toThrow("got arguments to simplex");
});

test("simplex() fails with ill-defined ranks", () => {
  const dag = square();
  const layout = simplex().rank((node: DagNode<SimpleDatum>) => {
    if (node.data.id === "0") {
      return 1;
    } else if (node.data.id === "3") {
      return 0;
    } else {
      return undefined;
    }
  });
  expect(() => layout(dag)).toThrow(
    "check that rank or group accessors are not ill-defined"
  );
});

test("simplex() fails with ill-defined group", () => {
  const dag = square();
  const layout = simplex().group((node: DagNode<SimpleDatum>) =>
    node.data.id === "0" || node.data.id === "3" ? "group" : undefined
  );
  expect(() => layout(dag)).toThrow(
    "check that rank or group accessors are not ill-defined"
  );
});
