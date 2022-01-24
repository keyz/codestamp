import shell from "shelljs";
import type { ExecOutputReturnValue } from "shelljs";

function exec(command: string): ExecOutputReturnValue {
  const { stdout, stderr, code } = shell.exec(command, {
    silent: true,
    fatal: true,
    env: {
      ...process.env,
      JEST_TEST_ENV: "true", // Mock CLI version and stuff
      FORCE_COLOR: "3", // Force colored output for tests
    },
  });

  return { stdout, stderr, code };
}

function fatalExec(command: string): string {
  const result = exec(command);

  if (result.code !== 0) {
    throw result;
  }

  return result.stdout;
}

export { exec, fatalExec };
