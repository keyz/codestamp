import { createHash } from "crypto";
import { memo } from "./utils";
import replaceAll from "replace-string"; // For Node v12.x

const HASH_LENGTH = 32;

const getHash = memo((input: string): string => {
  return createHash("sha256")
    .update(input, "utf-8")
    .digest("hex")
    .substring(0, HASH_LENGTH);
});

const PLACEHOLDER_HASH_ONLY = getHash("placeholder");
const PLACEHOLDER_STAMP = `CodeStamp<<${PLACEHOLDER_HASH_ONLY}>>`;
const STAMP_REGEX = /(?<left>CodeStamp<<)(?<hash>[a-f0-9]+)(?<right>>>)/;
const STAMP_REGEX_GLOBAL = new RegExp(STAMP_REGEX, "g");

/**
 * Parameter for {@link verifyStamp}.
 */
export type TVerifyStampParam = {
  /**
   * A list of strings that are contents of dependencies.
   *
   * Pass an empty array if there are no dependencies.
   */
  dependencyContentList: Array<string>;
  /**
   * The content that you want to verify.
   */
  targetContent: string;
};

/**
 * Verify the stamp within a string.
 *
 * @example
 *
 * ```typescript
 * verifyStamp({
 *   dependencyContentList: ["a", "b", "c"],
 *   targetContent: "CodeStamp<<c2bc05f0d406fdc32e9bd617b5b0903a>>",
 * })
 * ```
 *
 * @param param - See {@link TVerifyStampParam}
 * @throws When the stamp is invalid
 */
function verifyStamp({
  dependencyContentList,
  targetContent,
}: TVerifyStampParam): void {
  const matchList = [...targetContent.matchAll(STAMP_REGEX_GLOBAL)];

  if (matchList.length < 1) {
    throw new Error(
      `CodeStamp: Unable to find stamp in ${JSON.stringify(targetContent)}`
    );
  } else if (matchList.length > 1) {
    throwOnMultipleStampsFound({ matchList, content: targetContent });
  }

  const hashInTarget = matchList[0]?.groups?.hash;
  const targetContentWithPlaceholderHash = updateHashOnly({
    content: targetContent,
    newStampHash: PLACEHOLDER_HASH_ONLY,
  });

  const hash = getHash(
    JSON.stringify([...dependencyContentList, targetContentWithPlaceholderHash])
  );

  if (hashInTarget !== hash) {
    throw new Error(
      `CodeStamp: Stamps don't match.\nExpected: ${JSON.stringify(
        hash
      )}\nReceived: ${JSON.stringify(hashInTarget)}`
    );
  }
}

export type TStampPlacer = ({
  content,
  stamp,
}: {
  content: string;
  stamp: string;
}) => string;

const defaultPlaceInitialStamp: TStampPlacer = ({ content, stamp }) => {
  return `/* @generated ${stamp} */\n${content}`;
};

function getStampPlacerFromTemplate(template: string): TStampPlacer {
  return ({ content, stamp }) => {
    return replaceAll(
      replaceAll(template, "%STAMP%", stamp),
      "%CONTENT%",
      content
    );
  };
}

/**
 * Parameter for {@link applyStamp}.
 */
export type TApplyStampParam = {
  /**
   * A list of strings that are contents of dependencies.
   *
   * Pass an empty array if there are no dependencies.
   */
  dependencyContentList: Array<string>;
  /**
   * The content that you want to stamp.
   */
  targetContent: string;
  /**
   * A function or a template string for placing the stamp. It's recommended
   * to use the function form when using the Node API.
   *
   * - Function type: `(param: {content: string, stamp: string}) => string`.
   * - Template string: A string that contains two special formatters,
   *   `%STAMP%` and `%CONTENT%`. `codestamp` will replace `%STAMP%` with
   *   the stamp hash, and `%CONTENT%` with the rest of content.
   *
   * NOTE: The stamp must be returned from the function or included in the string.
   *
   * @example Add a JS banner comment
   *
   * ```typescript
   * ({ content, stamp }) => `// @generated ${stamp} DO NOT EDIT BY HAND\n${content}`;
   * ```
   *
   * @example Add a Python banner comment
   *
   * ```typescript
   * ({ content, stamp }) => `# @codegen ${stamp}\n${content}`;
   * ```
   *
   * @example Dynamically place the stamp as a JSON field
   *
   * ```typescript
   * ({ content, stamp }) => {
   *   const stampedObject = {...JSON.parse(content), stamp};
   *   return JSON.stringify(stampedObject, null, 2);
   * }
   * ```
   */
  placeInitialStamp?: TStampPlacer | string;
};

/**
 * Given a list of dependencies and a target content, deterministically add or
 * update a stamp and return the string.
 *
 * @example
 *
 * ```typescript
 * applyStamp({
 *   dependencyContentList: [],
 *   targetContent: "foobar",
 *   placeInitialStamp: ({ content, stamp }) => `// @codegen ${stamp}\n${content}`,
 * })
 * ```
 *
 * @param param - See {@link TApplyStampParam}
 * @returns Newly stamped content string
 */
function applyStamp({
  dependencyContentList,
  targetContent,
  placeInitialStamp,
}: TApplyStampParam): string {
  let placer = defaultPlaceInitialStamp;

  if (typeof placeInitialStamp === "string") {
    placer = getStampPlacerFromTemplate(placeInitialStamp);
  } else if (typeof placeInitialStamp === "function") {
    placer = placeInitialStamp;
  }

  let targetContentWithPlaceholderHash = "";

  const matchList = [...targetContent.matchAll(STAMP_REGEX_GLOBAL)];

  if (matchList.length < 1) {
    // Fresh content
    targetContentWithPlaceholderHash = placer({
      content: targetContent,
      stamp: PLACEHOLDER_STAMP,
    });

    if (!STAMP_REGEX.test(targetContentWithPlaceholderHash ?? "")) {
      if (typeof placeInitialStamp === "string") {
        throw new Error(
          `CodeStamp: \`placeInitialStamp\` must contain the stamp.\nTemplate: ${JSON.stringify(
            placeInitialStamp
          )}\nReturn value: ${JSON.stringify(targetContentWithPlaceholderHash)}`
        );
      } else {
        throw new Error(
          `CodeStamp: \`placeInitialStamp(...)\` must return a string that contains the stamp.\nReturn value: ${JSON.stringify(
            targetContentWithPlaceholderHash
          )}`
        );
      }
    }
  } else if (matchList.length > 1) {
    throwOnMultipleStampsFound({ matchList, content: targetContent });
  } else {
    targetContentWithPlaceholderHash = updateHashOnly({
      content: targetContent,
      newStampHash: PLACEHOLDER_HASH_ONLY,
    });

    if (placeInitialStamp != null) {
      // Attempt to rewrite the stamp placement

      const contentWithoutDefaultStamp =
        targetContentWithPlaceholderHash.replace(
          defaultPlaceInitialStamp({ content: "", stamp: PLACEHOLDER_STAMP }),
          ""
        );

      if (contentWithoutDefaultStamp !== targetContentWithPlaceholderHash) {
        // Great, the previous stamp placement was the default one.
        // Remove it and apply the new stamp placer
        targetContentWithPlaceholderHash = placer({
          content: contentWithoutDefaultStamp,
          stamp: PLACEHOLDER_STAMP,
        });
      }
    }
  }

  const hash = getHash(
    JSON.stringify([...dependencyContentList, targetContentWithPlaceholderHash])
  );

  return updateHashOnly({
    content: targetContentWithPlaceholderHash,
    newStampHash: hash,
  });
}

// Assumes the content contains a single stamp
function updateHashOnly({
  content,
  newStampHash,
}: {
  content: string;
  newStampHash: string;
}): string {
  return content.replace(STAMP_REGEX, `$<left>${newStampHash}$<right>`);
}

function throwOnMultipleStampsFound({
  matchList,
  content,
}: {
  matchList: Array<RegExpMatchArray>;
  content: string;
}) {
  const stampsFound = matchList
    .map((item) => JSON.stringify(`<<${item.groups?.hash ?? "Unknown"}>>`))
    .join(", ");

  throw new Error(
    `CodeStamp: Found multiple stamps. This is likely because you manually updated the content. Please regenerate the file.\nStamps: ${stampsFound}\nContent: ${JSON.stringify(
      content
    )}`
  );
}

export { verifyStamp, applyStamp };
