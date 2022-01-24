import { runner } from "./runner";
import { TRunnerParam } from "./runner";
import { applyStamp } from "./core";
import type { TApplyStampParam } from "./core";

// The parameters are inlined to make the documentation easier to
// read. Here are some compile-time checks to make sure the
// definitions don't go out of sync.

// https://github.com/Microsoft/TypeScript/issues/27024#issuecomment-421529650
// prettier-ignore
type AssertEqual<X, Y> = 
  (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2)
    ? X
    : never;

// Ensure `runner`'s parameter === `TRunnerParam`
export function __typecheckRunnerNoop(): TRunnerParam {
  const value: AssertEqual<TRunnerParam, Parameters<typeof runner>[0]> =
    {} as any;
  return value;
}

// Ensure `applyStamp`'s parameter === `TApplyStampParam`
export function __typecheckApplyStampNoop(): TApplyStampParam {
  const value: AssertEqual<TApplyStampParam, Parameters<typeof applyStamp>[0]> =
    {} as any;
  return value;
}
