/**
 * `fn`, remembering its last result while it is called with the same arguments (===). For the island's heavy derived
 * data (its layout, the seabed, the fish, the sea's glints): a scene that suspends while it loads is rendered again and
 * again before it first commits, and React keeps no `useMemo` of a render it never committed (measured on entering the
 * island: six renders, each re-deriving them all).
 */
export function lastCall<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  let last: { args: A; out: R } | null = null;
  return (...args: A) => {
    if (!last || args.length !== last.args.length || args.some((a, i) => a !== last!.args[i])) last = { args, out: fn(...args) };
    return last.out;
  };
}
