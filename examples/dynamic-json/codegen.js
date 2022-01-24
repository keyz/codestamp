// @ts-check
const fs = require("fs");
const path = require("path");
const data = require("../source.json");

main();

function main() {
  const { players } = data;

  const newData = {
    data: {
      firstNames: players.map((name) => name.split(" ")[0]),
    },
  };

  fs.writeFileSync(
    path.resolve(__dirname, "output.json"),
    JSON.stringify(newData, null, 2),
    "utf-8"
  );

  console.log("generated output.json");
}
