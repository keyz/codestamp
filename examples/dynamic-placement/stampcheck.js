// @ts-check
const { runner } = require("codestamp");

main();

function main() {
  const shouldWrite = process.argv.includes("--write");

  runner({
    targetFilePath: "output.json",
    shouldWrite,
    dependencyGlobList: ["source.json", "codegen.js"],
    placeInitialStamp: ({ content, stamp }) => {
      // Insert the stamp as a JSON field
      const stampedJsonObject = {
        ...JSON.parse(content),
        stamp,
      };

      return JSON.stringify(stampedJsonObject, null, 2);
    },
    cwd: __dirname,
  });
}
