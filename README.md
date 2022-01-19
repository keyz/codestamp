# codestamp - Stamp and verify your files and contents

[![main](https://github.com/keyz/codestamp/actions/workflows/main.yml/badge.svg)](https://github.com/keyz/codestamp/actions/workflows/main.yml)

`codestamp` is a tool for verifying the integrity of your files. It's most useful for guarding codegen'd files against unintentional manual edits, but it also can be used for signing individual files.

## Recommended workflow

1️⃣ Codegen your files as usual, then run `codestamp` to add a stamp.

- `codestamp` computes a deterministic hash (e.g., `CodeStamp<<c1aa4ff2ac747d1192773354ad64d122>>`) from the contents of your target file and all dependencies.
- By default, `codestamp` inserts the stamp as a banner comment. You can use the CLI (`--template`) to make small tweaks, or use the Node.js API to dynamically place the stamp (see [`examples/dynamic-placement/stampcheck.js`](examples/dynamic-placement/stampcheck.js)).

2️⃣ Run `codestamp` as a Git pre-commit hook and on CI; treat it as a linter for your codegen'd files.

- `codestamp` will verify the stamp against the files, and `exit(1)` when the stamp is no longer valid.

3️⃣ Profit

## Install

```bash
# Locally
$ npm install --save-dev codestamp

# Or globally
$ npm install -g codestamp
```

`codestamp` comes with a CLI and a Node.js API.

## Command Line

### CLI Usage

```bash
$ codestamp target_file [options]
```

### CLI Options

#### `-w, --write` (`boolean`)

Rewrite the file in-place. Without this flag, `codestamp` runs in verification mode: it prints the diff to stdout and `exit(1)` when the stamp is no longer valid.

#### `-d, --deps` (comma-separated `string`)

One or more file paths or globs. The stamp hash is computed from the target file's content and all dependencies.

Make sure to quote the globs to let `codestamp` expands the globs, rather than your shell.

Example:

```bash
$ codestamp target.ts --deps 'data/foo.json'
$ codestamp target.ts --deps 'data/foo.json,types/*.ts'
$ codestamp target.ts --deps 'data/**/*.json,types/*.ts'
```

#### `-t, --template` (`string`)

A template string for placing the stamp. `codestamp` will replace `%STAMP%` with the stamp hash, and `%CONTENT%` with the rest of content.

Use the Node.js API if you want to dynamically place the stamp.

Example:

```bash
$ codestamp target.py --template '# @codegen %STAMP%\\n%CONTENT%'
```

#### `-h, --help`

This help guide.

### CLI Examples

```diff
$ ./your-script-that-generates-types --from ffi.rs,data.json
# Generates `types.ts` from `ffi.rs` and `data.json`

$ cat types.ts
type FFI = ...

$ codestamp types.ts --deps ffi.rs,data.json
+ /* @generated CodeStamp<<c1aa4ff2ac747d1192773354ad64d122>> */
type FFI = ...

$ codestamp types.ts --deps ffi.rs,data.json --write
CodeStamp: 🔏 Stamped `types.ts`.

$ codestamp types.ts --deps ffi.rs,data.json
CodeStamp: ✅ Verified `types.ts`.

$ codestamp types.ts --deps ffi.rs,data.json --write
CodeStamp: ✅ Verified `types.ts`.

# If you updated `ffi.rs` but forgot to run the codegen script...
$ codestamp types.ts --deps ffi.rs,data.json
- /* @generated CodeStamp<<c1aa4ff2ac747d1192773354ad64d122>> */
+ /* @generated CodeStamp<<64adca472a2638d8c915fb5d83c688f7>> */
type FFI = ...

$ echo $?
1
```

## Node.js API

### `runner(...)`

`runner(...)` reads contents from disk and verifies the stamp. The CLI is a thin wrapper around `runner(...)`.

````typescript
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
}: TRunnerParam): Promise<void>;

/**
 * Parameter for {@link runner}.
 */
type TRunnerParam = {
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
````

### `applyStamp(...)` and `verifyStamp(...)`

`applyStamp(...)` and `verifyStamp(...)` work on strings, not file paths. In other words, they are low-level building blocks for stamping and verification.

````typescript
/**
 * Given a list of dependencies and a target content, deterministically add or
 * update a stamp and return the string.
 *
 * @example
 *
 * ```typescript
 * applyStamp({
 *   dependencyContentList: [],
 *   targetContent: "foobar",
 *   placeInitialStamp: ({ content, stamp }) => `// @codegen ${stamp}\n${content}`,
 * })
 * ```
 *
 * @param param - See {@link TApplyStampParam}
 * @returns Newly stamped content string
 */
function applyStamp({
  dependencyContentList,
  targetContent,
  placeInitialStamp,
}: TApplyStampParam): string;

/**
 * Parameter for {@link applyStamp}.
 */
type TApplyStampParam = {
  /**
   * A list of strings that are contents of dependencies.
   *
   * Pass an empty array if there are no dependencies.
   */
  dependencyContentList: Array<string>;
  /**
   * The content that you want to stamp.
   */
  targetContent: string;
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
};

/**
 * Verify the stamp within a string.
 *
 * @example
 *
 * ```typescript
 * verifyStamp({
 *   dependencyContentList: ["a", "b", "c"],
 *   targetContent: "CodeStamp<<c2bc05f0d406fdc32e9bd617b5b0903a>>",
 * })
 * ```
 *
 * @param param - See {@link TVerifyStampParam}
 * @throws When the stamp is invalid
 */
function verifyStamp({
  dependencyContentList,
  targetContent,
}: TVerifyStampParam): void;

/**
 * Parameter for {@link verifyStamp}.
 */
type TVerifyStampParam = {
  /**
   * A list of strings that are contents of dependencies.
   *
   * Pass an empty array if there are no dependencies.
   */
  dependencyContentList: Array<string>;
  /**
   * The content that you want to verify.
   */
  targetContent: string;
};
````

## Acknowledgments

`codestamp` is inspired by a similar code signing system at Facebook. There's an open source version ([`signedsource`](https://github.com/facebook/fbjs/blob/main/packages/signedsource/index.js)) in `fbjs`, but it's a bit hard to customize and track contents of dependencies.

## License

MIT
