#!/usr/bin/env node
// @ts-check

const chalk = require("chalk");
const parseArgs = require("minimist");
const { version } = require("../package.json");
const { runner } = require("../dist/index");

const help =
  reindent(`
    ${chalk.bold(
      "codestamp"
    )} - Stamp and verify your files and contents [version ${version}]

    codestamp is a tool for verifying the integrity of your files. It's most
    useful for guarding codegen'd files against unintentional manual edits, 
    but it also can be used for signing individual files.

    ${chalk.bold("Usage")}
        $ codestamp target_file [options]

    ${chalk.bold("Options")}
        -w, --write       Rewrite the file in-place. Without this flag, codestamp
        [boolean]         runs in verification mode: it prints the diff to stdout 
                          and \`exit(1)\` when the stamp is no longer valid.

        -d, --deps        One or more file paths or globs. The stamp hash is
        [comma-separated  computed from the target file's content and all 
        string]           dependencies.

                          Make sure to quote the globs to let codestamp expands
                          the globs, rather than your shell.

                          Examples:
                          $ codestamp target.ts --deps 'data/foo.json'
                          $ codestamp target.ts --deps 'data/foo.json,types/*.ts'
                          $ codestamp target.ts --deps 'data/**/*.json,types/*.ts'

        -t, --template    A template string for placing the stamp. codestamp will
        [string]          replace \`%STAMP%\` with the stamp hash, and \`%CONTENT%\`
                          with the rest of content.

                          Use the Node.js API to dynamically place the stamp.

                          Examples:
                          $ codestamp target.py -t '# @codegen %STAMP%\\n%CONTENT%'

        -h, --help        This help guide.

    ${chalk.bold("Example")}
        $ ./your-script-that-generates-types --from ffi.rs,data.json
        # Generates \`types.ts\` from \`ffi.rs\` and \`data.json\`

        $ cat types.ts
        type FFI = ...
        
        $ codestamp types.ts --deps ffi.rs,data.json
        ${chalk.green(
          "+ /* @generated CodeStamp<<c1aa4ff2ac747d1192773354ad64d122>> */"
        )}
          type FFI = ...

        $ codestamp types.ts --deps ffi.rs,data.json --write
        CodeStamp: 🔏 Stamped \`types.ts\`.

        $ codestamp types.ts --deps ffi.rs,data.json
        CodeStamp: ✅ Verified \`types.ts\`.

        $ codestamp types.ts --deps ffi.rs,data.json --write
        CodeStamp: ✅ Verified \`types.ts\`.

        # If you updated \`ffi.rs\` but forgot to run the codegen script...
        $ codestamp types.ts --deps ffi.rs,data.json
        ${chalk.red(
          "- /* @generated CodeStamp<<c1aa4ff2ac747d1192773354ad64d122>> */"
        )}
        ${chalk.green(
          "+ /* @generated CodeStamp<<64adca472a2638d8c915fb5d83c688f7>> */"
        )}
          type FFI = ...
        
        $ echo $?
        1
  `) + "\n";

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const argv = parseArgs(process.argv.slice(2), {
    boolean: ["write", "help"],
    string: ["deps", "template"],
    alias: {
      w: "write",
      d: "deps",
      t: "template",
      h: "help",
    },
  });

  if (argv.help) {
    console.log(help);
    return;
  }

  if (argv._.length !== 1) {
    const errorMessage = reindent(`
      CodeStamp Error: Missing required argument \`target_file\`.

      Run \`codestamp --help\` to see the quick guide and examples.
    `);

    console.log(errorMessage);
    process.exit(1);
  }

  const targetFilePath = String(argv._[0]);
  const shouldWrite = Boolean(argv.write);
  const rawDeps = argv.deps || "";
  const rawTemplate = argv.template || "";

  // TODO: Write a test
  const dependencyGlobList = rawDeps.split(",").filter(Boolean);
  const placeInitialStamp = Boolean(rawTemplate)
    ? undoUnescape(rawTemplate)
    : undefined;

  runner({
    targetFilePath,
    shouldWrite,
    dependencyGlobList,
    placeInitialStamp,
  });
}

/**
 * @param {string} input
 * @returns {string}
 */
function reindent(input) {
  const lineList = input.split("\n");
  const secondLineIndent = (lineList[1] || "").match(/^\s*/)[0].length;

  if (secondLineIndent === 0) {
    return input;
  }

  const regex = new RegExp(`^[ \\t]{${secondLineIndent}}`, "gm");

  return input.replace(regex, "").trim();
}

/**
 * @param {string} input
 * @returns {string}
 */
function undoUnescape(input) {
  try {
    return JSON.parse(`"${input}"`);
  } catch (_) {
    return input;
  }
}
