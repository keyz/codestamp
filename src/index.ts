import { applyStamp } from "./core";
import { runner } from "./runner";
import type {
  TApplyStampParam,
  TApplyStampResult,
  TStampPlacer,
  TStampRemover,
  TFormatter,
} from "./core";
import type {
  TRunnerParam,
  TRunnerResult,
  TRunnerFileTransformerForHashing,
} from "./runner";

export { runner, applyStamp };

export type {
  TRunnerParam,
  TRunnerResult,
  TRunnerFileTransformerForHashing,
  TApplyStampParam,
  TApplyStampResult,
  TStampPlacer,
  TStampRemover,
  TFormatter,
};
