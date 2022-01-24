import { fatalExec } from "./testUtils";

test("Examples should be legit", () => {
  fatalExec("npm run codegen --workspaces");

  expect(fatalExec("npm run codestamp:write --workspaces")).toMatch(
    "CodeStamp: 🔏 Stamped `output.json`."
  );

  fatalExec("npm run prettier:write");

  expect(fatalExec("npm run codestamp --workspaces")).toMatch(
    "CodeStamp: ✅ Verified `output.json`."
  );

  fatalExec("npm run prettier:check");
});
