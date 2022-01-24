import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import { glob } from "glob";

export function memo<I, O>(fn: (input: I) => O): (input: I) => O {
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

type TItem = {
  absoluteFilePath: string;
  relativeFilePath: string;
  content: string;
};

export async function globToItemList({
  rawPattern,
  cwd,
}: {
  rawPattern: string | Array<string>;
  cwd: string;
}): Promise<Array<TItem>> {
  const asyncGlob = promisify(glob);

  const patternList = Array.isArray(rawPattern) ? rawPattern : [rawPattern];

  const result: Array<TItem> = [];

  await Promise.all(
    patternList.map(async (pattern) => {
      const relativeFilePathList = await asyncGlob(pattern, {
        absolute: false,
        cwd,
        nodir: true,
      });

      await Promise.all(
        relativeFilePathList.map(async (relativeFilePath) => {
          const absoluteFilePath = path.resolve(cwd, relativeFilePath);

          const content = await fs.promises.readFile(absoluteFilePath, "utf-8");

          result.push({
            absoluteFilePath,
            relativeFilePath,
            content,
          });
        })
      );
    })
  );

  // Sort by absolute path to get a stable result
  return [...result].sort((item1, item2) =>
    item1.absoluteFilePath.localeCompare(item2.absoluteFilePath)
  );
}

export function assertNever(x: never): never {
  throw new Error(`Unexpected non-never: ${x}`);
}

export function nullThrows<T>(x: T | null | undefined): T {
  if (x == null) {
    throw new Error(`Unexpected null or undefined: ${x}`);
  }

  return x;
}
