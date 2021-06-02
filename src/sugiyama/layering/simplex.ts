/**
 * Assigns every node a layer with the goal of minimizing the number of dummy
 * nodes (long edges) inserted. Computing this layering requires solving an
 * integer linear program, which may take a long time, although in practice is
 * often quite fast. This is often known as the network simplex layering from
 * [Gansner et al. [1993}]](https://www.graphviz.org/Documentation/TSE93.pdf).
 *
 * Create a new {@link SimplexOperator} with {@link simplex}.
 *
 * <img alt="simplex example" src="media://simplex.png" width="400">
 *
 * @module
 */

import { Constraint, Solve, SolverDict, Variable } from "javascript-lp-solver";
import { Dag, DagNode } from "../../dag/node";
import { GroupAccessor, LayeringOperator, RankAccessor } from ".";
import { LinkDatum, NodeDatum } from "../utils";
import { Up, bigrams, def } from "../../utils";

interface Operators {
  rank: RankAccessor;
  group: GroupAccessor;
}

type OpDagNode<O extends RankAccessor | GroupAccessor> = Parameters<O>[0];
type OpNodeDatum<O extends RankAccessor | GroupAccessor> = NodeDatum<
  OpDagNode<O>
>;
type OpLinkDatum<O extends RankAccessor | GroupAccessor> = LinkDatum<
  OpDagNode<O>
>;
type OpsNodeDatum<Ops extends Operators> = OpNodeDatum<Ops["rank"]> &
  OpNodeDatum<Ops["group"]>;
type OpsLinkDatum<Ops extends Operators> = OpLinkDatum<Ops["rank"]> &
  OpLinkDatum<Ops["group"]>;
type OpsDagNode<Ops extends Operators> = DagNode<
  OpsNodeDatum<Ops>,
  OpsLinkDatum<Ops>
>;

export interface SimplexOperator<Ops extends Operators = Operators>
  extends LayeringOperator<OpsNodeDatum<Ops>, OpsLinkDatum<Ops>> {
  /**
   * Set the {@link RankAccessor}. Any node with a rank assigned will have a second
   * ordering enforcing ordering of the ranks. Note, this can cause the simplex
   * optimization to be ill-defined, and may result in an error during layout.
   */
  rank<NewRank extends RankAccessor>(
    // NOTE this is necessary for type inference
    newRank: NewRank
  ): SimplexOperator<Up<Ops, { rank: NewRank }>>;
  /**
   * Get the current {@link RankAccessor}.
   */
  rank(): Ops["rank"];

  /**
   * Set the {@link GroupAccessor}. Any node with a group assigned will have a second
   * ordering enforcing all nodes with the same group have the same layer.
   * Note, this can cause the simplex optimization to be ill-defined, and may
   * result in an error during layout.
   */
  group<NewGroup extends GroupAccessor>(
    newGroup: NewGroup
  ): SimplexOperator<Up<Ops, { group: NewGroup }>>;
  /**
   * Get the current {@link GroupAccessor}.
   */
  group(): Ops["group"];
}

/** @internal */
function buildOperator<Ops extends Operators>(
  options: Ops
): SimplexOperator<Ops> {
  function simplexCall(dag: Dag<OpsNodeDatum<Ops>, OpsLinkDatum<Ops>>): void {
    const variables: SolverDict<Variable> = {};
    const ints: SolverDict<number> = {};
    const constraints: SolverDict<Constraint> = {};

    const ids = new Map(
      dag
        .idescendants()
        .entries()
        .map(([i, node]) => [node, i.toString()] as const)
    );

    /** get node id */
    function n(node: OpsDagNode<Ops>): string {
      return def(ids.get(node));
    }

    /** get variable associated with a node */
    function variable(node: OpsDagNode<Ops>): Variable {
      return variables[n(node)];
    }

    /** enforce that first occurs before second
     *
     * @param prefix determines a unique prefix to describe constraint
     * @param strict strictly before or possibly equal
     */
    function before(
      prefix: string,
      first: OpsDagNode<Ops>,
      second: OpsDagNode<Ops>,
      strict: boolean = true
    ): void {
      const fvar = variable(first);
      const svar = variable(second);
      const cons = `${prefix}: ${def(n(first))} -> ${def(n(second))}`;

      constraints[cons] = { min: +strict };
      fvar[cons] = -1;
      svar[cons] = 1;
    }

    /** enforce that first and second occur on the same layer */
    function equal(
      prefix: string,
      first: OpsDagNode<Ops>,
      second: OpsDagNode<Ops>
    ): void {
      before(`${prefix} before`, first, second, false);
      before(`${prefix} after`, second, first, false);
    }

    const ranks: [number, OpsDagNode<Ops>][] = [];
    const groups = new Map<string, OpsDagNode<Ops>[]>();

    // Add node variables and fetch ranks
    for (const node of dag) {
      const nid = n(node);
      ints[nid] = 1;
      variables[nid] = {
        opt: node.children.length
      };

      const rank = options.rank(node);
      if (rank !== undefined) {
        ranks.push([rank, node]);
      }
      const group = options.group(node);
      if (group !== undefined) {
        const existing = groups.get(group);
        if (existing) {
          existing.push(node);
        } else {
          groups.set(group, [node]);
        }
      }
    }

    // Add link constraints
    for (const link of dag.ilinks()) {
      before("link", link.source, link.target);
      ++variable(link.source).opt;
      --variable(link.target).opt;
    }

    // Add rank constraints
    const ranked = ranks.sort(([a], [b]) => a - b);
    for (const [[frank, fnode], [srank, snode]] of bigrams(ranked)) {
      if (frank < srank) {
        before("rank", fnode, snode);
      } else {
        equal("rank", fnode, snode);
      }
    }

    // group constraints
    for (const group of groups.values()) {
      for (const [first, second] of bigrams(group)) {
        equal("group", first, second);
      }
    }

    // NOTE bundling sets `this` to undefined, and we need it to be setable
    const { feasible, ...assignment } = Solve.call(
      {},
      {
        optimize: "opt",
        opType: "max",
        constraints: constraints,
        variables: variables,
        ints: ints
      }
    );
    if (!feasible) {
      /* istanbul ignore else */
      if (ranks.length || groups.size) {
        throw new Error(
          "could not find a feasbile simplex layout, check that rank or group accessors are not ill-defined"
        );
      } else {
        throw new Error(
          "could not find feasbile simplex layout, this should not happen"
        );
      }
    }

    // lp solver doesn't assign some zeros
    for (const node of dag) {
      node.value = assignment[n(node)] || 0;
    }
  }

  function rank<NR extends RankAccessor>(
    newRank: NR
  ): SimplexOperator<Up<Ops, { rank: NR }>>;
  function rank(): Ops["rank"];
  function rank<NR extends RankAccessor>(
    newRank?: NR
  ): SimplexOperator<Up<Ops, { rank: NR }>> | Ops["rank"] {
    if (newRank === undefined) {
      return options.rank;
    } else {
      const { rank: _, ...rest } = options;
      return buildOperator({ ...rest, rank: newRank });
    }
  }
  simplexCall.rank = rank;

  function group<NG extends GroupAccessor>(
    newGroup: NG
  ): SimplexOperator<Up<Ops, { group: NG }>>;
  function group(): Ops["group"];
  function group<NG extends GroupAccessor>(
    newGroup?: NG
  ): SimplexOperator<Up<Ops, { group: NG }>> | Ops["group"] {
    if (newGroup === undefined) {
      return options.group;
    } else {
      const { group: _, ...rest } = options;
      return buildOperator({ ...rest, group: newGroup });
    }
  }
  simplexCall.group = group;

  return simplexCall;
}

/** @internal */
function defaultAccessor(): undefined {
  return undefined;
}

/** Create a default {@link SimplexOperator}. */
export function simplex(
  ...args: never[]
): SimplexOperator<{
  rank: RankAccessor<unknown, unknown>;
  group: GroupAccessor<unknown, unknown>;
}> {
  if (args.length) {
    throw new Error(
      `got arguments to simplex(${args}), but constructor takes no aruguments.`
    );
  }
  return buildOperator({ rank: defaultAccessor, group: defaultAccessor });
}
