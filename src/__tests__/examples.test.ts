import shell from "shelljs";

beforeAll(() => {
  goodExec("npm run build");
});

test("Examples should be legit", () => {
  goodExec("npm run codegen --workspaces");
  goodExec("npm run codestamp:write --workspaces");
  goodExec("npm run codestamp --workspaces");
});

function goodExec(command: string) {
  expect(() => {
    shell.exec(command, {
      silent: true,
      fatal: true,
    });
  }).not.toThrow();
}
