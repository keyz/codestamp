import * as path from "path";
import { exec, fatalExec } from "./testUtils";

const bin = path.resolve(__dirname, "../../bin/cli.js");
const sourceJson = path.resolve(__dirname, "../../examples/source.json");
const invalidJson = path.resolve(__dirname, "../__fixtures__/invalid.json");

test("cli help", () => {
  const helpResult = fatalExec(`${bin} --help`);

  expect(fatalExec(`${bin} -h`)).toStrictEqual(helpResult);
  expect(fatalExec(`${bin} foobar.js -h`)).toStrictEqual(helpResult);
  expect(fatalExec(`${bin} foobar.js --write --help`)).toStrictEqual(
    helpResult
  );

  expect(helpResult).toMatchInlineSnapshot(`
    "[1mcodestamp[22m - Stamp and verify your files and contents [version <MOCKED>]

    A language-agnostic tool for signing and verifying the integrity of your
    files. It's most useful for guarding codegen'd files against unintentional
    manual edits, but it also can be used for signing individual files.

    [1mUsage[22m
        $ codestamp target_file [options]

    [1mOptions[22m
        -w, --write       Rewrite the file in-place. Without this flag, codestamp
        [boolean]         runs in verification mode: it prints the diff to
                          \`stderr\` and \`exit(1)\` when the stamp is invalid.

        -d, --deps        One or more file paths or globs. The stamp hash is
        [comma-separated  computed from the target file's content and all
        string]           dependencies.

                          Make sure to quote the globs to let codestamp expand
                          the globs, rather than your shell.

                          Examples:
                          $ codestamp target.ts --deps 'data/foo.json'
                          $ codestamp target.ts --deps 'data/foo.json,types/*.ts'
                          $ codestamp target.ts --deps 'data/**/*.json,types/*.ts'

        -t, --template    A template string for placing the stamp. codestamp will
        [string]          replace \`%STAMP%\` with the stamp, and \`%CONTENT%\`
                          with the rest of content.

                          Use the Node.js API to dynamically place the stamp.

                          Examples:
                          $ codestamp target.py -t '# @codegen %STAMP%\\\\n%CONTENT%'

        -h, --help        This help guide.

    [1mDocs[22m
        [4mhttps://github.com/keyz/codestamp[24m

    [1mExample[22m
        $ ./your-script-that-generates-types --from ffi.rs,data.json
        # Generates \`types.ts\` from \`ffi.rs\` and \`data.json\`

        $ cat types.ts
        type FFI = ...

        $ codestamp types.ts --deps ffi.rs,data.json
        [32m+ /* @generated CodeStamp<<c1aa4ff2ac747d1192773354ad64d122>> */[39m
          type FFI = ...

        $ codestamp types.ts --deps ffi.rs,data.json --write
        CodeStamp: 🔏 Stamped \`types.ts\`.

        $ codestamp types.ts --deps ffi.rs,data.json
        CodeStamp: ✅ Verified \`types.ts\`.

        $ codestamp types.ts --deps ffi.rs,data.json --write
        CodeStamp: ✅ Verified \`types.ts\`.

        # If you updated \`ffi.rs\` but forgot to run the codegen script...
        $ codestamp types.ts --deps ffi.rs,data.json
        [31m- /* @generated CodeStamp<<c1aa4ff2ac747d1192773354ad64d122>> */[39m
        [32m+ /* @generated CodeStamp<<64adca472a2638d8c915fb5d83c688f7>> */[39m
          type FFI = ...

        $ echo $?
        1

    "
  `);
});

test("cli errors", () => {
  expect(exec(bin)).toMatchInlineSnapshot(`
    Object {
      "code": 1,
      "stderr": "CodeStamp Error: Missing required argument \`target_file\`.

    Run \`codestamp --help\` to see the quick guide and examples.
    ",
      "stdout": "",
    }
  `);

  expect(exec(`${bin} doesNotExist.file`)).toMatchObject({
    code: 1,
  });

  expect(exec(`${bin} ${sourceJson} -t`)).toMatchInlineSnapshot(`
    Object {
      "code": 1,
      "stderr": "CodeStamp Error: Received empty value for option \`-t, --template\`.

    Run \`codestamp --help\` to see the quick guide and examples.
    ",
      "stdout": "",
    }
  `);

  expect(exec(`${bin} ${sourceJson} -d`)).toMatchInlineSnapshot(`
    Object {
      "code": 1,
      "stderr": "CodeStamp Error: Received empty value for option \`-d, --deps\`.

    Run \`codestamp --help\` to see the quick guide and examples.
    ",
      "stdout": "",
    }
  `);

  expect(exec(`${bin} ${invalidJson}`)).toMatchInlineSnapshot(`
    Object {
      "code": 1,
      "stderr": "CodeStamp: Found multiple stamps. This is likely because the content was manually updated. \`codestamp\` needs to bail out because it cannot guarantee a deterministic update. Please regenerate the file.
    Stamps: \\"CodeStamp<<cd7c7e09cdbabd54696a12d864243dcf>>\\", \\"CodeStamp<<bd54696a12d864243dcfcd7c7e09cdba>>\\"
    ",
      "stdout": "",
    }
  `);

  expect(exec(`${bin} ${sourceJson} --template "hello"`))
    .toMatchInlineSnapshot(`
      Object {
        "code": 1,
        "stderr": "CodeStamp: \`initialStampPlacer\` didn't return a stamp.
      Placer: \\"hello\\"
      Placer return value: \\"hello\\"
      ",
        "stdout": "",
      }
    `);

  expect(exec(`${bin} ${sourceJson} --template "%STAMP% %STAMP%"`))
    .toMatchInlineSnapshot(`
      Object {
        "code": 1,
        "stderr": "CodeStamp: \`initialStampPlacer\` returned multiple stamps.
      Placer: \\"%STAMP% %STAMP%\\"
      Placer return value: \\"CodeStamp<<4097889236a2af26c293033feb964c4c>> CodeStamp<<4097889236a2af26c293033feb964c4c>>\\"
      ",
        "stdout": "",
      }
    `);
});

test("cli exec", () => {
  const result = exec(
    `${bin} ${sourceJson} --template "// %STAMP%\n%CONTENT%"`
  );

  expect(exec(`${bin} ${sourceJson} -t "// %STAMP%\n%CONTENT%"`)).toStrictEqual(
    result
  );

  expect(result).toMatchInlineSnapshot(`
    Object {
      "code": 1,
      "stderr": "[32m+ // CodeStamp<<76cdbd71e69511b76d911eaeea731eda>>[39m
    [2m  {[22m
    [2m    \\"players\\": [\\"Stephen Curry\\", \\"LeBron James\\", \\"Klay Thompson\\"][22m
    [2m  }[22m

    ",
      "stdout": "",
    }
  `);
});
