import * as fs from "fs";
import * as path from "path";
import Chalk from "chalk";
import { diff } from "jest-diff";
import { applyStamp } from "./core";
import { globToItemList, assertNever } from "./utils";
import type { TApplyStampResult, TStampPlacer } from "./core";

// <DOCSTART SOURCE TRunnerParam>
/**
 * Parameter for {@link runner}.
 */
export type TRunnerParam = {
  /**
   * Path to the target file that will be verified by `codestamp`.
   */
  targetFilePath: string;
  /**
   * A list of file paths and/or globs. The stamp hash is computed
   * from the target file's content and all dependencies.
   *
   * Pass an empty array if you only want to stamp a standalone file.
   */
  dependencyGlobList: Array<string>;
  /**
   * Use it to specify where the stamp should be placed **initially**.
   * See {@link TStampPlacer}.
   */
  initialStampPlacer?: TStampPlacer;
  /**
   * Use it to ignore insignificant changes and make the stamp less
   * sensitive. See {@link TRunnerFileTransformerForHashing}
   *
   * @defaultValue `({content}) => content`
   */
  fileTransformerForHashing?: TRunnerFileTransformerForHashing;
  /**
   * Whether the file should be rewritten in-place. Without this flag,
   * `codestamp` will run in verification mode -- it won't write to
   * disk.
   */
  shouldWrite: boolean;
  /**
   * For `glob`: the current working directory in which to search.
   *
   * @defaultValue `process.cwd()`
   */
  cwd?: string;
  /**
   * Whether the runner should write to `stdout` and `stderr`.
   *
   * @defaultValue `false`
   */
  silent?: boolean;
};
// <DOCEND SOURCE TRunnerParam>
// <DOCSTART SOURCE TRunnerFileTransformerForHashing>
/**
 * Use it to ignore insignificant changes and make the stamp less
 * sensitive.
 *
 * Content will be transformed before hashing. The transformer only
 * applies to hashing (the stamp) and does not affect the final
 * content output.
 *
 * @example Ignore spacing and new lines in JSON
 *
 * ```typescript
 * ({content, absoluteFilePath}) => {
 *   if (path.extname(absoluteFilePath) === ".json") {
 *     return JSON.stringify(JSON.parse(content));
 *   }
 *
 *   return content;
 * }
 * ```
 *
 * @example Always exclude the stamp line from hashing
 *
 * ```typescript
 * (param) => {
 *   if (param.type !== "TARGET") {
 *     return param.content;
 *   }
 *
 *   return param.content
 *     .split("\n")
 *     .filter((line) => !line.includes(param.stamp))
 *     .join("\n");
 * }
 * ```
 */
export type TRunnerFileTransformerForHashing = (
  param: TRunnerFileTransformerParam
) => string;

type TRunnerFileTransformerParam =
  | {
      type: "DEPENDENCY";
      content: string;
      absoluteFilePath: string;
    }
  | {
      type: "TARGET";
      content: string;
      stamp: string;
      absoluteFilePath: string;
    };
// <DOCEND SOURCE TRunnerFileTransformerForHashing>
// <DOCSTART SOURCE TRunnerResult>
type DistributiveIntersection<Union, T> = Union extends {} ? Union & T : never;

/**
 * The return type is based on {@link TApplyStampResult}, with the
 * addition of some runner-specific fields.
 */
export type TRunnerResult = DistributiveIntersection<
  TApplyStampResult,
  {
    /**
     * Indicates whether the runner wrote to disk. Determined by
     * `shouldWrite`.
     *
     * For "OK" and "ERROR" statuses, the result is always `false`.
     */
    didWrite: boolean;
    /**
     * Indicates whether the caller should `exit(1)` if desired.
     * Useful for running on CI.
     */
    shouldFatalIfDesired: boolean;
  }
>;
// <DOCEND SOURCE TRunnerResult>

// <DOCSTART SOURCE runner>
/**
 * Reads contents from disk and verifies the stamp.
 *
 * - When `shouldWrite` is true, the file will be rewritten in-place.
 * - Otherwise, `codestamp` will run in verification mode -- it won't
 *   write to disk.
 *
 * @throws On I/O errors
 * @param param - See {@link TRunnerParam}
 * @returns See {@link TRunnerResult}
 */
export async function runner({
  targetFilePath,
  dependencyGlobList,
  shouldWrite,
  initialStampPlacer,
  fileTransformerForHashing = ({ content }) => content,
  cwd = process.cwd(),
  silent = false,
}: TRunnerParam): Promise<TRunnerResult> {
  // <DOCEND SOURCE runner>
  const absoluteTargetFilePath = path.resolve(cwd, targetFilePath);
  const currentFileContent = await fs.promises.readFile(
    absoluteTargetFilePath,
    "utf-8"
  );
  const dependencyItemList = await globToItemList({
    rawPattern: dependencyGlobList,
    cwd,
  });
  const applyStampResult = applyStamp({
    dependencyContentList: dependencyItemList.map(
      ({ content, absoluteFilePath }) =>
        fileTransformerForHashing({
          type: "DEPENDENCY",
          content,
          absoluteFilePath,
        })
    ),
    targetContent: currentFileContent,
    initialStampPlacer,
    contentTransformerForHashing: ({ content, stamp }) =>
      fileTransformerForHashing({
        type: "TARGET",
        content,
        stamp,
        absoluteFilePath: absoluteTargetFilePath,
      }),
  });

  switch (applyStampResult.status) {
    case "OK": {
      if (!silent) {
        console.log(`CodeStamp: ✅ Verified \`${targetFilePath}\`.`);
      }

      return {
        ...applyStampResult,
        didWrite: false,
        shouldFatalIfDesired: false,
      };
    }
    case "ERROR": {
      const { errorType, errorDescription } = applyStampResult;

      switch (errorType) {
        case "MULTIPLE_STAMPS": {
          if (!silent) {
            const stampsFound = applyStampResult.stampList
              .map((stamp) => JSON.stringify(stamp))
              .join(", ");

            console.error(
              `CodeStamp: ${errorDescription}\nStamps: ${stampsFound}`
            );
          }
          break;
        }
        case "STAMP_PLACER": {
          if (!silent) {
            const { errorDescription, placer, placerReturnValue } =
              applyStampResult;

            console.error(
              `CodeStamp: ${errorDescription}\nPlacer: ${JSON.stringify(
                placer
              )}\nPlacer return value: ${JSON.stringify(placerReturnValue)}`
            );
          }
          break;
        }
        default: {
          assertNever(applyStampResult);
        }
      }

      return {
        ...applyStampResult,
        didWrite: false,
        shouldFatalIfDesired: true,
      };
    }
    case "NEW":
    case "UPDATE": {
      const { newContent } = applyStampResult;

      if (shouldWrite) {
        await fs.promises.writeFile(
          path.resolve(targetFilePath),
          newContent,
          "utf-8"
        );
      }

      if (!silent) {
        if (shouldWrite) {
          console.log(`CodeStamp: 🔏 Stamped \`${targetFilePath}\`.`);
        } else {
          console.error(
            diff(currentFileContent, newContent, {
              omitAnnotationLines: true,
              aColor: Chalk.red,
              bColor: Chalk.green,
            })
          );
        }
      }

      return {
        ...applyStampResult,
        didWrite: shouldWrite,
        shouldFatalIfDesired: !shouldWrite,
      };
    }
    default: {
      assertNever(applyStampResult);
    }
  }
}
