// @ts-check
const fs = require("fs");
const path = require("path");
const data = require("./source.json");

main();

function main() {
  const { players } = data;

  const code = `print("${players.join(", ")}")\n`;

  fs.writeFileSync(path.resolve(__dirname, "output.py"), code, "utf-8");

  console.log("generated output.py");
}
