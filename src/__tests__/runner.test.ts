import * as path from "path";
import * as fs from "fs";
import { runner } from "../runner";

const ROOT_DIR_PATH = path.resolve(__dirname, "../..");
const TEMP_DIR_PATH = path.resolve(ROOT_DIR_PATH, "temp");

const sourceJson = path.resolve(ROOT_DIR_PATH, "examples/source.json");
const invalidJson = path.resolve(
  ROOT_DIR_PATH,
  "src/__fixtures__/invalid.json"
);

test("`runner`: silent", async () => {
  const logSpy = jest.spyOn(console, "log");
  const warnSpy = jest.spyOn(console, "warn");
  const errorSpy = jest.spyOn(console, "error");

  const silent = true;

  expect(
    await runner({
      targetFilePath: sourceJson,
      shouldWrite: false,
      dependencyGlobList: [],
      silent,
    })
  ).toMatchInlineSnapshot(`
    Object {
      "didWrite": false,
      "newContent": "/* @generated CodeStamp<<d9d562e935d0476ea08152e4283f41fb>> */
    {
      \\"players\\": [\\"Stephen Curry\\", \\"LeBron James\\", \\"Klay Thompson\\"]
    }
    ",
      "newStamp": "CodeStamp<<d9d562e935d0476ea08152e4283f41fb>>",
      "shouldFatalIfDesired": true,
      "status": "NEW",
    }
  `);

  expect(
    await runner({
      targetFilePath: invalidJson,
      shouldWrite: false,
      dependencyGlobList: [],
      silent,
    })
  ).toMatchInlineSnapshot(`
    Object {
      "didWrite": false,
      "errorDescription": "Found multiple stamps. This is likely because the content was manually updated. \`codestamp\` needs to bail out because it cannot guarantee a deterministic update. Please regenerate the file.",
      "errorType": "MULTIPLE_STAMPS",
      "shouldFatalIfDesired": true,
      "stampList": Array [
        "CodeStamp<<cd7c7e09cdbabd54696a12d864243dcf>>",
        "CodeStamp<<bd54696a12d864243dcfcd7c7e09cdba>>",
      ],
      "status": "ERROR",
    }
  `);

  await fs.promises.mkdir(TEMP_DIR_PATH, { recursive: true });
  const newTempFilePath = path.resolve(TEMP_DIR_PATH, "new.ts");
  await fs.promises.writeFile(newTempFilePath, "export {};\n", "utf-8");

  const result = await runner({
    targetFilePath: newTempFilePath,
    shouldWrite: true,
    dependencyGlobList: [],
    silent,
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "didWrite": true,
      "newContent": "/* @generated CodeStamp<<207b5f4854d95a5896c15d1b4c18d41e>> */
    export {};
    ",
      "newStamp": "CodeStamp<<207b5f4854d95a5896c15d1b4c18d41e>>",
      "shouldFatalIfDesired": false,
      "status": "NEW",
    }
  `);

  expect(result.status === "NEW" && result.newContent).toStrictEqual(
    await fs.promises.readFile(newTempFilePath, "utf-8")
  );

  expect(
    await runner({
      targetFilePath: newTempFilePath,
      shouldWrite: true,
      dependencyGlobList: [],
      silent,
    })
  ).toMatchInlineSnapshot(`
    Object {
      "didWrite": false,
      "shouldFatalIfDesired": false,
      "stamp": "CodeStamp<<207b5f4854d95a5896c15d1b4c18d41e>>",
      "status": "OK",
    }
  `);

  expect(logSpy).not.toHaveBeenCalled();
  expect(warnSpy).not.toHaveBeenCalled();
  expect(errorSpy).not.toHaveBeenCalled();
});
