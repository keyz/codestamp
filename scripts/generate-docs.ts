import fs from "fs";
import path from "path";
import { globToItemList } from "../src/utils";

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

    const contentToInsert = sourceCodeContentMap[keyToInsertAfter];

    if (contentToInsert == null) {
      throw new Error(
        `Key "${keyToInsertAfter}" was not found in the source code`
      );
    }

    result.push(transformContent(contentToInsert));
  }

  await fs.promises.writeFile(README_FILE_PATH, result.join("\n"), "utf-8");
}

function transformContent(rawContent: string): string {
  let content = rawContent;

  if (rawContent[rawContent.length - 1] === "{") {
    content = rawContent.substring(0, rawContent.length - 1);
  }

  return ["```typescript", content, "```"].join("\n");
}

async function genSourceCodeContentMap(): Promise<{ [key: string]: string }> {
  const contentMap: { [key: string]: string } = {};

  const sourceFileList = await globToItemList({
    rawPattern: "src/*.ts",
    cwd: ROOT_DIR_PATH,
  });

  for (const sourceFile of sourceFileList) {
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

      contentMap[key] = content;
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

  return sortObject(
    markerMap,
    (item1, item2) => item1.value.DOCSTART.index - item2.value.DOCSTART.index
  );
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
