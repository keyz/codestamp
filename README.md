# codestamp - Stamp and verify your files and contents

[![npm](https://img.shields.io/npm/v/codestamp)](https://www.npmjs.com/package/codestamp) [![main](https://github.com/keyz/codestamp/actions/workflows/main.yml/badge.svg)](https://github.com/keyz/codestamp/actions/workflows/main.yml)

`codestamp` is a language-agnostic tool for signing and verifying the integrity of your files. It's most useful for guarding codegen'd files against unintentional manual edits, but it also can be used for signing individual files.

If you're new to codegen, ["Writing code that writes code — with Hack Codegen"](https://engineering.fb.com/2015/08/20/open-source/writing-code-that-writes-code-with-hack-codegen/) explains why it's important to sign and verify generated files.

## Table of contents

- [Getting Started](#getting-started)
  - [TL;DR (CLI Example)](#tldr-cli-example)
  - [Install](#install)
  - [More Examples](#more-examples)
  - [Recommended workflow](#recommended-workflow)
- [Documentation](#documentation)
  - [Command Line](#command-line)
    - [CLI Usage](#cli-usage)
    - [CLI Options](#cli-options)
  - [Node.js API](#nodejs-api)
    - [`runner(...)`](#runner)
    - [`applyStamp(...)`](#applystamp)
- [Acknowledgments](#acknowledgments)
- [License](#license)

## Getting Started

### TL;DR (CLI Example)

```diff
$ ./your-script-that-generates-types --from ffi.rs,data.json
# Generates `types.ts` from `ffi.rs` and `data.json`

$ cat types.ts
type FFI = ...

$ codestamp types.ts --deps ffi.rs,data.json
+ /* @generated CodeStamp<<​c1aa4ff2ac747d1192773354ad64d122​>> */
type FFI = ...

$ codestamp types.ts --deps ffi.rs,data.json --write
CodeStamp: 🔏 Stamped `types.ts`.

$ codestamp types.ts --deps ffi.rs,data.json
CodeStamp: ✅ Verified `types.ts`.

$ codestamp types.ts --deps ffi.rs,data.json --write
CodeStamp: ✅ Verified `types.ts`.

# If you updated `ffi.rs` but forgot to run the codegen script...
$ codestamp types.ts --deps ffi.rs,data.json
- /* @generated CodeStamp<<​c1aa4ff2ac747d1192773354ad64d122​>> */
+ /* @generated CodeStamp<<​64adca472a2638d8c915fb5d83c688f7​>> */
type FFI = ...

$ echo $?
1
```

### Install

`codestamp` comes with a simple CLI ([docs](#command-line)) and a Node.js API ([docs](#nodejs-api)).

```bash
# Install locally
$ npm install --save-dev codestamp

# Or use npx
$ npx codestamp@latest

# Or install globally
$ npm install -g codestamp
```

### More Examples

- [`examples/basic`](examples/basic/package.json): Simple stamping via the CLI.
- [`examples/template-python`](examples/template-python/package.json): Use template string to add a Python banner comment via the CLI.
- [`examples/dynamic-json`](examples/dynamic-json/stamp.js): Use the API to programmatically insert the stamp as a JSON field (via `initialStampPlacer`), and ignore insignificant spaces and new lines in JSON (via `fileTransformerForHashing`).
- 🙋 [`scripts/generate-docs.ts`](scripts/generate-docs.ts): The README file you're reading is generated and verified by `codestamp`! <!-- <CODESTAMP START> -->
  - And here's the stamp: `CodeStamp<<d508062897d6b3afb002faedb60e864e>>`
  <!-- <CODESTAMP END> -->

### Recommended workflow

1/ Codegen your files as usual, then run `codestamp` to add a stamp.

- `codestamp` computes a deterministic hash (e.g., `CodeStamp<<​c1aa4ff2ac747d1192773354ad64d122​>>`) from the contents of your target file and all dependencies.
- By default, `codestamp` inserts the stamp as a banner comment. You can use the CLI (`--template`) to make small tweaks, or use the Node.js API to dynamically place the stamp (see [`examples/dynamic-json/stamp.js`](examples/dynamic-json/stamp.js)).

2/ Run `codestamp` as a Git [pre-commit hook](https://github.com/typicode/husky) and on CI; treat it as a linter for your codegen'd files.

- The `codestamp` CLI will verify the stamp against the files, and `exit(1)` when the stamp is invalid.

3/ Profit

## Documentation

### Command Line

#### CLI Usage

```bash
$ codestamp target_file [options]
```

#### CLI Options

##### `-w, --write` (`boolean`)

Rewrite the file in-place. Without this flag, `codestamp` runs in verification mode: it prints the diff to `stderr` and `exit(1)` when the stamp is invalid.

##### `-d, --deps` (comma-separated `string`)

One or more file paths or globs. The stamp hash is computed from the target file's content and all dependencies.

Make sure to quote the globs to let `codestamp` expand the globs, rather than your shell.

Example:

```bash
$ codestamp target.ts --deps 'data/foo.json'
$ codestamp target.ts --deps 'data/foo.json,types/*.ts'
$ codestamp target.ts --deps 'data/**/*.json,types/*.ts'
```

##### `-t, --template` (`string`)

A template string for placing the stamp. `codestamp` will replace `%STAMP%` with the stamp, and `%CONTENT%` with the rest of content.

Use the Node.js API (see `TStampPlacer`) to dynamically place the stamp.

Example:

```bash
$ codestamp target.py --template '# @codegen %STAMP%\\n%CONTENT%'
```

##### `-h, --help`

This help guide.

### Node.js API

#### `runner(...)`

Reads contents from disk, then writes and verifies the stamp. The CLI is a thin wrapper around `runner(...)`.

[`examples/dynamic-json`](examples/dynamic-json/stamp.js) is a simple example of using the `runner`. It uses the API to programmatically insert the stamp as a JSON field (via `initialStampPlacer`), and ignore insignificant spaces and new lines in JSON (via `fileTransformerForHashing`).

You can also reference how this README/documentation file is generated, stamped, and verified in [`scripts/generate-docs.ts`](scripts/generate-docs.ts).

<!-- <DOCSTART TARGET runner> -->

```typescript
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
  initialStampRemover,
  fileTransformerForHashing = ({ content }) => content,
  cwd = process.cwd(),
  silent = false,
}: {
  targetFilePath: string;
  dependencyGlobList: Array<string>;
  shouldWrite: boolean;
  initialStampPlacer?: TStampPlacer;
  initialStampRemover?: TStampRemover;
  fileTransformerForHashing?: TRunnerFileTransformerForHashing;
  cwd?: string;
  silent?: boolean;
}): Promise<TRunnerResult>;
```

<!-- <DOCEND TARGET runner> -->

##### `TRunnerParam`

Parameter for [`runner(...)`](#runner).

<!-- <DOCSTART TARGET TRunnerParam> -->

```typescript
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
   * Whether the file should be rewritten in-place. Without this flag,
   * `codestamp` will run in verification mode -- it won't write to
   * disk.
   */
  shouldWrite: boolean;
  /**
   * Use it to specify where the stamp should be placed **initially**.
   * See {@link TStampPlacer}.
   */
  initialStampPlacer?: TStampPlacer;
  /**
   * Use it to remove (and update) a previously applied **custom**
   * stamp. See {@link TStampRemover} and {@link TStampPlacer}.
   */
  initialStampRemover?: TStampRemover;
  /**
   * Use it to ignore insignificant changes and make the stamp less
   * sensitive. See {@link TRunnerFileTransformerForHashing}
   *
   * @defaultValue `({content}) => content`
   */
  fileTransformerForHashing?: TRunnerFileTransformerForHashing;
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
```

<!-- <DOCEND TARGET TRunnerParam> -->

##### `TRunnerResult`

Return type for [`runner(...)`](#runner).

<!-- <DOCSTART TARGET TRunnerResult> -->

```typescript
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
```

<!-- <DOCEND TARGET TRunnerResult> -->

##### `TRunnerFileTransformerForHashing`

Ignore insignificant changes and make the stamp less sensitive.

<!-- <DOCSTART TARGET TRunnerFileTransformerForHashing> -->

````typescript
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
````

<!-- <DOCEND TARGET TRunnerFileTransformerForHashing> -->

#### `applyStamp(...)`

`applyStamp(...)` works on strings, not file paths. In other words, it's a low-level building block for stamping and verification.

You likely won't need this function, unless you want to verify content without file system I/O.

<!-- <DOCSTART TARGET applyStamp> -->

```typescript
/**
 * Given a list of dependencies and a target content,
 * deterministically add or update a stamp.
 *
 * @param param - See {@link TApplyStampParam}
 * @returns See {@link TApplyStampResult}
 */
export function applyStamp({
  dependencyContentList,
  targetContent,
  initialStampPlacer,
  initialStampRemover,
  contentTransformerForHashing = ({ content }) => content,
}: {
  dependencyContentList: Array<string>;
  targetContent: string;
  initialStampPlacer?: TStampPlacer;
  initialStampRemover?: TStampRemover;
  contentTransformerForHashing?: (param: {
    content: string;
    stamp: string;
  }) => string;
}): TApplyStampResult;
```

<!-- <DOCEND TARGET applyStamp> -->

##### `TApplyStampParam`

Parameter for [`applyStamp(...)`](#applystamp).

<!-- <DOCSTART TARGET TApplyStampParam> -->

````typescript
/**
 * Parameter for {@link applyStamp}.
 */
export type TApplyStampParam = {
  /**
   * A list of strings that are contents of dependencies.
   *
   * Pass an empty array if there are no dependencies.
   *
   * NOTE: order matters.
   */
  dependencyContentList: Array<string>;
  /**
   * The content to stamp.
   */
  targetContent: string;
  /**
   * Use it to specify where the stamp should be placed **initially**.
   * See {@link TStampPlacer} and {@link TStampRemover}.
   *
   * @defaultValue {@link defaultInitialStampPlacer}
   */
  initialStampPlacer?: TStampPlacer;
  /**
   * Use it to remove (and update) a previously applied **custom**
   * stamp. See {@link TStampRemover} and {@link TStampPlacer}.
   */
  initialStampRemover?: TStampRemover;
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
   * ({ content }) => JSON.stringify(JSON.parse(content))
   * ```
   *
   * @example Always exclude the stamp line from hashing
   *
   * ```typescript
   * ({ content, stamp }) =>
   *   content.split("\n").filter((line) => !line.includes(stamp)).join("\n")
   * ```
   *
   * @defaultValue `({content}) => content`
   */
  contentTransformerForHashing?: (param: {
    content: string;
    stamp: string;
  }) => string;
};
````

<!-- <DOCEND TARGET TApplyStampParam> -->

##### `TStampPlacer`

Specify where the initial stamp should be placed.

<!-- <DOCSTART TARGET TStampPlacer> -->

````typescript
/**
 * A function or a template string for placing the stamp. It's
 * recommended to use the function form when using the Node API.
 *
 * Use it to specify where the stamp should be placed **initially**.
 * If you update `initialStampPlacer` from another **custom** placer,
 * you must also define `initialStampRemover` ({@link TStampRemover})
 * to instruct how your previous stamp should be removed. Otherwise
 * the format change won't be applied (because `codestamp` doesn't
 * have enough context to make a safe change), although the stamp
 * itself will always be updated correctly.
 *
 * NOTE: A single and complete stamp must be returned as-is from the
 * function or included in the string.
 *
 * - Function type: `({content: string, stamp: string}) => string`.
 * - Template string: A string that contains two special formatters,
 *   `%STAMP%` and `%CONTENT%`. `codestamp` will replace `%STAMP%`
 *   with the stamp, and `%CONTENT%` with the rest of content.
 *
 * NOTE: When `initialStampPlacer` is invoked, it's guaranteed that
 * the value of `content` does not include `stamp`.
 *
 * ```typescript
 * content.indexOf(stamp) === -1 // guaranteed
 * ```
 *
 * @example Add a JS banner comment
 *
 * ```typescript
 * ({ content, stamp }) => `// @generated ${stamp} DO NOT EDIT BY HAND\n${content}`;
 *
 * // Template string equivalent:
 * `// @generated %STAMP% DO NOT EDIT BY HAND\n%CONTENT%`
 * ```
 *
 * @example Add a Python banner comment
 *
 * ```typescript
 * ({ content, stamp }) => `# @codegen ${stamp}\n${content}`;
 *
 * // Template string equivalent:
 * `# @codegen %STAMP%\n%CONTENT%`
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
export type TStampPlacer = TFormatter | string;

export type TFormatter = ({
  content,
  stamp,
}: {
  content: string;
  stamp: string;
}) => string;

const defaultInitialStampPlacer: TFormatter = ({ content, stamp }) =>
  `/* @generated ${stamp} */\n${content}`;
````

<!-- <DOCEND TARGET TStampPlacer> -->

##### `TStampRemover`

Specify how the initial stamp should be removed and updated.

<!-- <DOCSTART TARGET TStampRemover> -->

````typescript
/**
 * The inverse of `initialStampPlacer` ({@link TStampPlacer}). Use it
 * to remove (and update) a previously applied **custom** stamp (the
 * default stamp will always be removed automatically).
 *
 * If you update `initialStampPlacer` from another custom placer, you
 * must define this function to instruct how your previous stamp
 * should be removed. Otherwise the format change won't be applied,
 * although the stamp itself will always be updated correctly.
 *
 * NOTE: When `initialStampRemover` is invoked, it's guaranteed that
 * the value of `content` includes `stamp`.
 *
 * NOTE: In some scenarios, you might find it easier to just
 * completely regenerate the file. Instead of writing to and reading
 * from the same target file, introduce an intermediate representation
 * as your source of truth, and only write to the final target file.
 *
 * ```typescript
 * content.indexOf(stamp) !== -1 // guaranteed
 * ```
 *
 * In other words, `initialStampRemover` won't be called if `content`
 * doesn't contain a `stamp` yet.
 *
 * @example Update a custom Python multiline banner comment
 *
 * ```typescript
 * {
 *   initialStampPlacer: ({content, stamp}) => {
 *     return `# GENERATED ${stamp}\n# DO NOT EDIT BY HAND\n${content}`;
 *   },
 *   initialStampRemover: ({content, stamp}) => {
 *     const contentLineList = content.split('\n');
 *     const indexOfStamp = contentLineList.findIndex(
 *       line => line.includes(stamp),
 *     );
 *
 *     contentLineList.splice(indexOfStamp, 2);
 *     return contentLineList.join('\n');
 *   },
 * }
 * ```
 *
 * @example Recommended: place invisible markers to specify the range
 * of insertion and deletion. This is a much more robust approach.
 *
 * ```typescript
 * // First, put START and END markers in your target file, such as:
 * // <!-- <CODESTAMP START> -->
 * //
 * // <!-- <CODESTAMP END> -->
 *
 * {
 *   initialStampPlacer: ({ content, stamp }) => {
 *     const lineList = content.split("\n");
 *     const startIndex = lineList.findIndex((line) =>
 *       line.includes(`<!-- <CODESTAMP START> -->`)
 *     );
 *     const endIndex = lineList.findIndex((line) =>
 *       line.includes(`<!-- <CODESTAMP END> -->`)
 *     );
 *     // Assert both `startIndex` and `endIndex` !== -1
 *
 *     lineList.splice(
 *       startIndex + 1,
 *       0,
 *       `here's the stamp: ${stamp}`
 *     );
 *
 *     return lineList.join("\n");
 *   },
 *   initialStampRemover: ({ content, stamp }) => {
 *     const lineList = content.split("\n");
 *     const startIndex = lineList.findIndex((line) =>
 *       line.includes(`<!-- <CODESTAMP START> -->`)
 *     );
 *     const endIndex = lineList.findIndex((line) =>
 *       line.includes(`<!-- <CODESTAMP END> -->`)
 *     );
 *     // Assert both `startIndex` and `endIndex` !== -1
 *
 *     lineList.splice(startIndex + 1, endIndex - startIndex - 1);
 *     return lineList.join("\n");
 *   },
 * }
 * ```
 */
export type TStampRemover = TFormatter;
````

<!-- <DOCEND TARGET TStampRemover> -->

##### `TApplyStampResult`

Return type for [`applyStamp(...)`](#applystamp).

<!-- <DOCSTART TARGET TApplyStampResult> -->

```typescript
/**
 * Return type for {@link applyStamp}. This is a discriminated union.
 */
export type TApplyStampResult =
  /**
   * Content is legit.
   */
  | {
      status: "OK";
      /** The stamp extracted from content */
      stamp: string;
    }
  /**
   * Content didn't have a stamp; a new stamp is added.
   */
  | {
      status: "NEW";
      /** The new stamp being added */
      newStamp: string;
      /** Value of the updated content */
      newContent: string;
    }
  /**
   * Stamp needs an update.
   */
  | {
      status: "UPDATE";
      /** The new/expected stamp */
      newStamp: string;
      /** The old/current stamp */
      oldStamp: string;
      /** Value of the updated content */
      newContent: string;
    }
  /**
   * The content includes multiple stamps. This is likely because the
   * content was manually updated. `codestamp` needs to bail out
   * because it cannot guarantee a deterministic update.
   */
  | {
      status: "ERROR";
      errorType: "MULTIPLE_STAMPS";
      errorDescription: string;
      /** >= 2 stamps */
      stampList: Array<string>;
    }
  /**
   * Placer didn't return a string that contains the stamp, or
   * returned multiple stamps.
   */
  | {
      status: "ERROR";
      errorType: "STAMP_PLACER";
      errorDescription: string;
      placer: string;
      placerReturnValue: any;
    };
```

<!-- <DOCEND TARGET TApplyStampResult> -->

## Acknowledgments

`codestamp` is inspired by similar code signing systems at Facebook.

- [`signedsource` in `fbjs`](https://github.com/facebook/fbjs/blob/main/packages/signedsource/index.js): Used by Relay, but doesn't allow customization or tracking of dependencies
- [`Hack Codegen`](https://github.com/hhvm/hack-codegen): Great abstraction and design, but only supports generating and signing Hack code

## License

MIT
