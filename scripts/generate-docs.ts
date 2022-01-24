import fs from "fs";
import path from "path";
import shell from "shelljs";
import { runner } from "../src";
import { globToItemList } from "../src/utils";
import type { TRunnerResult } from "../src";

const SOURCE_REGEX =
  /^\s*\/\/ <(?<marker>DOCSTART|DOCEND) SOURCE (?<key>[^\s]+)>\s*$/;
const TARGET_REGEX =
  /^\s*<!-- <(?<marker>DOCSTART|DOCEND) TARGET (?<key>[^\s]+)> -->\s*$/;

const ROOT_DIR_PATH = path.resolve(__dirname, "..");
const README_FILE_PATH = path.resolve(ROOT_DIR_PATH, "README.md");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const shouldWrite = process.argv.includes("--write");

  // First, copy docstrings from source code to the README
  const dependencyPathList = await codegen({ shouldWrite });

  if (shouldWrite) {
    // Then stamp the file
    await stamp({ dependencyPathList, shouldWrite });
    // Run Prettier
    fatalExec("prettier --write README.md");
    // For this particular markdown file, Prettier needs to make significant changes
    // (such as updating some triple backticks to quadruple backticks), so we'll need to
    // stamp the file again (i.e. update the stamp) after Prettier finishes
    await stamp({ dependencyPathList, shouldWrite });
  }

  // Finally, verify
  const finalRunnerResult = await stamp({ dependencyPathList, shouldWrite });

  if (
    finalRunnerResult.status !== "OK" ||
    finalRunnerResult.didWrite !== false
  ) {
    console.error(finalRunnerResult);
    throw new Error(
      `Expected runner result to be "OK", got ${finalRunnerResult.status}`
    );
  }
}

async function stamp({
  dependencyPathList,
  shouldWrite,
}: {
  dependencyPathList: Array<string>;
  shouldWrite: boolean;
}): Promise<TRunnerResult> {
  const runnerResult = await runner({
    targetFilePath: README_FILE_PATH,
    dependencyGlobList: dependencyPathList,
    shouldWrite,
    initialStampPlacer: ({ content, stamp }) => {
      const contentLineList = content.split("\n");
      const indexOfExamples = contentLineList.findIndex((line) =>
        line.startsWith("### More Examples")
      );

      invariant(indexOfExamples !== -1, `Couldn't found examples`);

      const firstBulletPointIndex = contentLineList.findIndex(
        (line, index) => line.startsWith("- ") && index > indexOfExamples
      );
      let insertIndex = firstBulletPointIndex;
      invariant(insertIndex !== -1, `Couldn't found bullet point`);

      while (true) {
        if (!contentLineList[insertIndex]!.startsWith("- ")) {
          break;
        }
        insertIndex++;
      }

      contentLineList.splice(
        insertIndex,
        0,
        `- 🙋 [\`scripts/generate-docs.ts\`](scripts/generate-docs.ts): The README file you're reading is generated and verified by \`codestamp\`!`,
        `  - And here's the stamp: \`${stamp}\``
      );

      return contentLineList.join("\n");
    },
    initialStampRemover: ({ content, stamp }) => {
      const contentLineList = content.split("\n");
      const indexOfStamp = contentLineList.findIndex((line) =>
        line.includes(stamp)
      );

      invariant(indexOfStamp !== -1, `Couldn't found stamp`);

      contentLineList.splice(indexOfStamp - 1, 2);
      return contentLineList.join("\n");
    },
    fileTransformerForHashing: (param) => {
      if (param.type === "DEPENDENCY") {
        return param.content;
      }

      if (path.extname(param.absoluteFilePath) !== ".md") {
        throw new Error(`Expected a .md file, got ${param.absoluteFilePath}`);
      }

      // Remove all empty lines and whitespaces before hashing
      return param.content
        .split("\n")
        .filter((line) => !line.includes(param.stamp)) // also exclude the stamp line
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n");
    },
    silent: false,
  });

  if (runnerResult.shouldFatalIfDesired) {
    process.exit(1);
  }

  return runnerResult;
}

async function codegen({
  shouldWrite,
}: {
  shouldWrite: boolean;
}): Promise<Array<string>> {
  const result: Array<string> = [];

  const markdownContent = await fs.promises.readFile(README_FILE_PATH, "utf-8");
  const markdownLineList = markdownContent.split("\n");

  const instructionList = getInsertionInstructionList(markdownLineList);
  const sourceCodeContentMap = await genSourceCodeContentMap();

  for (const instruction of instructionList) {
    const { keyToInsertAfter } = instruction;

    const markdownSegment = markdownLineList
      .slice(instruction.start, instruction.end + 1)
      .join("\n");

    result.push(markdownSegment);

    if (keyToInsertAfter == null) {
      continue;
    }

    const contentToInsert = sourceCodeContentMap[keyToInsertAfter]?.content;

    if (contentToInsert == null) {
      throw new Error(
        `Key "${keyToInsertAfter}" was not found in the source code`
      );
    }

    result.push(transformContent(contentToInsert));
  }

  if (shouldWrite) {
    await fs.promises.writeFile(README_FILE_PATH, result.join("\n"), "utf-8");
  }

  return [
    ...new Set(
      Object.keys(sourceCodeContentMap).map(
        (key) => sourceCodeContentMap[key]!.absoluteFilePath!
      )
    ),
  ];
}

function transformContent(rawContent: string): string {
  let content = rawContent;

  if (rawContent[rawContent.length - 1] === "{") {
    content = rawContent.substring(0, rawContent.length - 1);
  }

  return ["```typescript", content, "```"].join("\n");
}

type TSourceCodeContentMap = {
  [key: string]: {
    content: string;
    absoluteFilePath: string;
  };
};

async function genSourceCodeContentMap(): Promise<TSourceCodeContentMap> {
  const contentMap: TSourceCodeContentMap = {};

  const sourceFileList = await globToItemList({
    rawPattern: "src/*.ts",
    cwd: ROOT_DIR_PATH,
  });

  for (const sourceFile of sourceFileList) {
    const { absoluteFilePath } = sourceFile;

    const lineList = sourceFile.content.split("\n");
    const markerMap = getMarkerMap({ lineList, regex: SOURCE_REGEX });

    for (const key in markerMap) {
      const { DOCSTART, DOCEND } = markerMap[key]!;
      const content = lineList
        .slice(DOCSTART.index + 1, DOCEND.index)
        .join("\n");

      if (!content.includes(key)) {
        throw new Error(`Content doesn't include key: ${key}`);
      }

      if (contentMap[key] != null) {
        throw new Error(`Duplicate key found: ${key}`);
      }

      contentMap[key] = { content, absoluteFilePath };
    }
  }

  return contentMap;
}

type TMarkerMap = {
  [key: string]: {
    DOCSTART: { rawLine: string; index: number; key: string };
    DOCEND: { rawLine: string; index: number; key: string };
  };
};

function getMarkerMap({
  lineList,
  regex,
}: {
  lineList: Array<string>;
  regex: RegExp;
}): TMarkerMap {
  const markerMap: TMarkerMap = {};

  lineList.forEach((line, index) => {
    const maybeMatch = line.match(regex);

    if (maybeMatch) {
      const key = maybeMatch.groups!.key!;
      const marker = maybeMatch.groups!.marker!;

      if (marker !== "DOCEND" && marker !== "DOCSTART") {
        throw new Error(`Unknown marker ${marker}`);
      }

      markerMap[key] = markerMap[key] ?? ({} as any);

      if (markerMap[key]![marker] != null) {
        throw new Error(`Duplicate marker found for ${key}: ${marker}`);
      }

      markerMap[key]![marker] = {
        rawLine: line,
        index,
        key,
      };
    }
  });

  const sortedMarkerMap = sortObject(
    markerMap,
    (item1, item2) => item1.value.DOCSTART.index - item2.value.DOCSTART.index
  );

  // Sanity check
  Object.keys(sortedMarkerMap).forEach((key, index, keyList) => {
    const item = sortedMarkerMap[key]!;

    invariant(item.DOCSTART.index < item.DOCEND.index);

    if (index !== keyList.length - 1) {
      const nextKey = keyList[index + 1]!;
      const nextItem = sortedMarkerMap[nextKey]!;
      invariant(item.DOCEND.index < nextItem.DOCSTART.index);
    }
  });

  return sortedMarkerMap;
}

type TInsertionInstructionList = Array<{
  // All inclusive
  start: number;
  end: number;
  keyToInsertAfter: string | null;
}>;

function getInsertionInstructionList(
  lineList: Array<string>
): TInsertionInstructionList {
  const insertionOrder: TInsertionInstructionList = [];

  const markerMap = getMarkerMap({
    lineList,
    regex: TARGET_REGEX,
  });

  const keyList = Object.keys(markerMap);

  keyList.forEach((key, keyIndex) => {
    if (keyIndex === 0) {
      // First item
      insertionOrder.push({
        start: 0,
        end: markerMap[key]!.DOCSTART.index,
        keyToInsertAfter: key,
      });
    } else {
      const previousKey = keyList[keyIndex - 1]!;

      insertionOrder.push({
        start: markerMap[previousKey]!.DOCEND.index,
        end: markerMap[key]!.DOCSTART.index,
        keyToInsertAfter: key,
      });
    }

    // Last item, extra push
    if (keyIndex === keyList.length - 1) {
      insertionOrder.push({
        start: markerMap[key]!.DOCEND.index,
        end: lineList.length - 1,
        keyToInsertAfter: null,
      });
    }
  });

  return insertionOrder;
}

function sortObject<V>(
  input: { [key: string]: V },
  fn: (a: { key: string; value: V }, b: { key: string; value: V }) => number
): { [key: string]: V } {
  const result: { [key: string]: V } = {};

  const sortedInputList: Array<{ key: string; value: V }> = Object.keys(input)
    .map((key) => ({ key, value: input[key]! }))
    .sort(fn);

  for (const { key, value } of sortedInputList) {
    result[key] = value;
  }

  return result;
}

function invariant(condition: any, errorMessage?: string) {
  if (!condition) {
    throw new Error(errorMessage ?? `Unexpected ${condition}`);
  }
}

function fatalExec(command: string): void {
  const result = shell.exec(command, {
    silent: false,
    fatal: true,
  });

  if (result.code !== 0) {
    throw result;
  }
}
