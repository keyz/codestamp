import { fatalExec } from "../src/__tests__/testUtils";

export default function globalSetup() {
  // Compile for the CLI
  fatalExec("npm run build");
}
