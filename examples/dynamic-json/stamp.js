// @ts-check
const path = require("path");
const { runner } = require("codestamp");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const shouldWrite = process.argv.includes("--write");

  const result = await runner({
    targetFilePath: "output.json",
    shouldWrite,
    dependencyGlobList: ["../source.json", "codegen.js"],
    initialStampPlacer: ({ content, stamp }) => {
      // Insert the stamp as a JSON field
      const stampedJsonObject = {
        ...JSON.parse(content),
        stamp,
      };

      return JSON.stringify(stampedJsonObject, null, 2);
    },
    fileTransformerForHashing: ({ content, absoluteFilePath }) => {
      // Ignore spacing and new lines in JSON
      if (path.extname(absoluteFilePath) === ".json") {
        return JSON.stringify(JSON.parse(content));
      }

      return content;
    },
    cwd: __dirname,
    silent: false,
  });

  if (result.shouldFatalIfDesired) {
    process.exit(1);
  }
}
