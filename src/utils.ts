import * as fs from "fs";
import { promisify } from "util";
import { glob } from "glob";

function memo<I, O>(fn: (input: I) => O): (input: I) => O {
  const cache = new Map<I, O>();

  return (input: I): O => {
    if (cache.has(input)) {
      return cache.get(input)!;
    }

    const result = fn(input);
    cache.set(input, result);
    return result;
  };
}

async function globToItemList({
  rawPattern,
  cwd,
}: {
  rawPattern: string | Array<string>;
  cwd: string;
}): Promise<Array<{ filePath: string; content: string }>> {
  const asyncGlob = promisify(glob);

  const patternList = Array.isArray(rawPattern) ? rawPattern : [rawPattern];

  const result: Array<{ filePath: string; content: string }> = [];

  await Promise.all(
    patternList.map(async (pattern) => {
      const filePathList = await asyncGlob(pattern, {
        absolute: true,
        cwd,
        nodir: true,
      });

      await Promise.all(
        filePathList.map(async (filePath) => {
          const content = await fs.promises.readFile(filePath, "utf-8");

          result.push({
            filePath,
            content,
          });
        })
      );
    })
  );

  // Stable result
  return [...result].sort((item1, item2) =>
    item1.filePath.localeCompare(item2.filePath)
  );
}

export { memo, globToItemList };
