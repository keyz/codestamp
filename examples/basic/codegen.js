// @ts-check
const fs = require("fs");
const path = require("path");
const data = require("../source.json");

main();

function main() {
  const { players } = data;

  const code = `type TPlayer = ${players
    .map((name) => JSON.stringify(name))
    .join(" | ")};\n`;

  fs.writeFileSync(path.resolve(__dirname, "output.ts"), code, "utf-8");

  console.log("generated output.ts");
}
