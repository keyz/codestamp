import * as fs from "fs";
import * as path from "path";
import Chalk from "chalk";
import { diff } from "jest-diff";
import { applyStamp } from "./core";
import { globToItemList } from "./utils";
import type { TStampPlacer } from "./core";

/**
 * Parameter for {@link runner}.
 */
export type TRunnerParam = {
  /**
   * Path to the target file that will be verified by `codestamp`.
   */
  targetFilePath: string;
  /**
   * Whether the file should be rewritten in-place. Without this flag,
   * `codestamp` runs in verification mode: it prints the diff to `stdout`
   * and `exit(1)` when the stamp is invalid.
   */
  shouldWrite: boolean;
  /**
   * A list of file paths and/or globs. The stamp hash is computed from
   * the target file's content and all dependencies.
   *
   * Pass an empty array if you only want to stamp a standalone file.
   */
  dependencyGlobList: Array<string>;
  /**
   * A function or a template string for placing the stamp. It's recommended
   * to use the function form when using the Node API.
   *
   * - Function type: `(param: {content: string, stamp: string}) => string`.
   * - Template string: A string that contains two special formatters,
   *   `%STAMP%` and `%CONTENT%`. `codestamp` will replace `%STAMP%` with
   *   the stamp hash, and `%CONTENT%` with the rest of content.
   *
   * NOTE: The stamp must be returned from the function or included in the string.
   *
   * @example Add a JS banner comment
   *
   * ```typescript
   * ({ content, stamp }) => `// @generated ${stamp} DO NOT EDIT BY HAND\n${content}`;
   * ```
   *
   * @example Add a Python banner comment
   *
   * ```typescript
   * ({ content, stamp }) => `# @codegen ${stamp}\n${content}`;
   * ```
   *
   * @example Dynamically place the stamp as a JSON field
   *
   * ```typescript
   * ({ content, stamp }) => {
   *   const stampedObject = {...JSON.parse(content), stamp};
   *   return JSON.stringify(stampedObject, null, 2);
   * }
   * ```
   */
  placeInitialStamp?: TStampPlacer | string;
  /**
   * For `glob`: the current working directory in which to search.
   *
   * @defaultValue `process.cwd()`
   */
  cwd?: string;
};

/**
 * Reads contents from disk and verifies the stamp.
 *
 * - When `shouldWrite` is true, the file will be rewritten in-place.
 * - Otherwise, `codestamp` will run in verification mode: it prints
 *   the diff to `stdout` and `exit(1)` when the stamp is invalid.
 *
 * @param param - See {@link TRunnerParam}
 */
async function runner({
  targetFilePath,
  shouldWrite,
  dependencyGlobList,
  placeInitialStamp,
  cwd = process.cwd(),
}: TRunnerParam): Promise<void> {
  const targetFileContent = await fs.promises.readFile(
    path.resolve(targetFilePath),
    "utf-8"
  );
  const dependencyItemList = await globToItemList({
    rawPattern: dependencyGlobList,
    cwd,
  });

  const newFileContent = applyStamp({
    dependencyContentList: dependencyItemList.map((item) => item.content),
    targetContent: targetFileContent,
    placeInitialStamp,
  });

  if (targetFileContent === newFileContent) {
    console.log(`CodeStamp: ✅ Verified \`${targetFilePath}\`.`);
    return;
  } else {
    if (shouldWrite) {
      await fs.promises.writeFile(
        path.resolve(targetFilePath),
        newFileContent,
        "utf-8"
      );
      console.log(`CodeStamp: 🔏 Stamped \`${targetFilePath}\`.`);
      return;
    } else {
      console.log(
        diff(targetFileContent, newFileContent, {
          omitAnnotationLines: true,
          aColor: Chalk.red,
          bColor: Chalk.green,
        })
      );
      process.exit(1);
    }
  }
}

export { runner };
