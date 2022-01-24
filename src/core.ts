import { createHash } from "crypto";
import { memo, nullThrows } from "./utils";
import replaceAll from "replace-string"; // For Node v12.x

const HASH_LENGTH = 32;

const getHashedStamp = memo((input: string): string => {
  const stampHash = createHash("sha256")
    .update(input, "utf-8")
    .digest("hex")
    .substring(0, HASH_LENGTH);

  return `CodeStamp<<${stampHash}>>`;
});

// CodeStamp<<4097889236a2af26c293033feb964c4c>>
const PLACEHOLDER_STAMP = getHashedStamp("placeholder");
const STAMP_REGEX = /(?<stamp>CodeStamp<<[a-f0-9]+>>)/;
const STAMP_REGEX_GLOBAL = new RegExp(STAMP_REGEX, "g");

// <DOCSTART SOURCE TStampPlacer>
/**
 * A function or a template string for placing the stamp. It's
 * recommended to use the function form when using the Node API.
 *
 * Use it to specify where the stamp should be placed **initially**.
 * Updating the placer on content that already uses a **custom**
 * placer has no effect, because `codestamp` cannot guarantee a
 * deterministic update. In this case, although the format won't
 * change, the existing stamp will always be updated correctly.
 *
 * Please regenerate the file when you update the placer from another
 * custom placer.
 *
 * NOTE: A single and complete stamp must be returned as-is from the
 * function or included in the string.
 *
 * - Function type: `({content: string, stamp: string}) => string`.
 * - Template string: A string that contains two special formatters,
 *   `%STAMP%` and `%CONTENT%`. `codestamp` will replace `%STAMP%`
 *   with the stamp, and `%CONTENT%` with the rest of content.
 *
 * @example Add a JS banner comment
 *
 * ```typescript
 * ({ content, stamp }) => `// @generated ${stamp} DO NOT EDIT BY HAND\n${content}`;
 *
 * // Template string equivalent:
 * `// @generated %STAMP% DO NOT EDIT BY HAND\n%CONTENT%`
 * ```
 *
 * @example Add a Python banner comment
 *
 * ```typescript
 * ({ content, stamp }) => `# @codegen ${stamp}\n${content}`;
 *
 * // Template string equivalent:
 * `# @codegen %STAMP%\n%CONTENT%`
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
export type TStampPlacer = TStampPlacerFn | string;

type TStampPlacerFn = ({
  content,
  stamp,
}: {
  content: string;
  stamp: string;
}) => string;

const defaultInitialStampPlacer: TStampPlacerFn = ({ content, stamp }) =>
  `/* @generated ${stamp} */\n${content}`;
// <DOCEND SOURCE TStampPlacer>

function getStampPlacerFromTemplate(template: string): TStampPlacerFn {
  return ({ content, stamp }) => {
    return replaceAll(
      replaceAll(template, "%STAMP%", stamp),
      "%CONTENT%",
      content
    );
  };
}

// <DOCSTART SOURCE TApplyStampParam>
/**
 * Parameter for {@link applyStamp}.
 */
export type TApplyStampParam = {
  /**
   * A list of strings that are contents of dependencies.
   *
   * Pass an empty array if there are no dependencies.
   *
   * NOTE: order matters.
   */
  dependencyContentList: Array<string>;
  /**
   * The content to stamp.
   */
  targetContent: string;
  /**
   * Use it to specify where the stamp should be placed **initially**.
   * See {@link TStampPlacer}.
   *
   * @defaultValue {@link defaultInitialStampPlacer}
   */
  initialStampPlacer?: TStampPlacer;
  /**
   * Use it to ignore insignificant changes and make the stamp less
   * sensitive.
   *
   * Content will be transformed before hashing. The transformer only
   * applies to hashing (the stamp) and does not affect the final
   * content output.
   *
   * @example Ignore spacing and new lines in JSON
   *
   * ```typescript
   * ({ content }) => JSON.stringify(JSON.parse(content))
   * ```
   *
   * @example Always exclude the stamp line from hashing
   *
   * ```typescript
   * ({ content, stamp }) =>
   *   content.split("\n").filter((line) => !line.includes(stamp)).join("\n")
   * ```
   *
   * @defaultValue `({content}) => content`
   */
  contentTransformerForHashing?: (param: {
    content: string;
    stamp: string;
  }) => string;
};
// <DOCEND SOURCE TApplyStampParam>

// <DOCSTART SOURCE TApplyStampResult>
/**
 * Return type for {@link applyStamp}. This is a discriminated union.
 */
export type TApplyStampResult =
  /**
   * Content is legit.
   */
  | {
      status: "OK";
      /** The stamp extracted from content */
      stamp: string;
    }
  /**
   * Content didn't have a stamp; a new stamp is added.
   */
  | {
      status: "NEW";
      /** The new stamp being added */
      newStamp: string;
      /** Value of the updated content */
      newContent: string;
    }
  /**
   * Stamp needs an update.
   */
  | {
      status: "UPDATE";
      /** The new/expected stamp */
      newStamp: string;
      /** The old/current stamp */
      oldStamp: string;
      /** Value of the updated content */
      newContent: string;
    }
  /**
   * The content includes multiple stamps. This is likely because the
   * content was manually updated. `codestamp` needs to bail out
   * because it cannot guarantee a deterministic update.
   */
  | {
      status: "ERROR";
      errorType: "MULTIPLE_STAMPS";
      errorDescription: string;
      /** >= 2 stamps */
      stampList: Array<string>;
    }
  /**
   * Placer didn't return a string that contains the stamp, or
   * returned multiple stamps.
   */
  | {
      status: "ERROR";
      errorType: "STAMP_PLACER";
      errorDescription: string;
      placer: string;
      placerReturnValue: any;
    };
// <DOCEND SOURCE TApplyStampResult>

// <DOCSTART SOURCE applyStamp>
/**
 * Given a list of dependencies and a target content,
 * deterministically add or update a stamp.
 *
 * @param param - See {@link TApplyStampParam}
 * @returns See {@link TApplyStampResult}
 */
export function applyStamp({
  dependencyContentList,
  targetContent,
  initialStampPlacer,
  contentTransformerForHashing = ({ content }) => content,
}: TApplyStampParam): TApplyStampResult {
  // <DOCEND SOURCE applyStamp>
  let newContentWithPlaceholderStamp: string;

  const matchList = [...targetContent.matchAll(STAMP_REGEX_GLOBAL)];

  if (matchList.length === 0) {
    // "NEW" - Fresh content, apply placer
    const maybeResult = applyPlacer({
      content: targetContent,
      stamp: PLACEHOLDER_STAMP,
      placer: initialStampPlacer,
    });

    if (!maybeResult.ok) {
      return maybeResult.error;
    }

    newContentWithPlaceholderStamp = maybeResult.value;
  } else if (matchList.length > 1) {
    // "ERROR"
    return {
      status: "ERROR",
      errorType: "MULTIPLE_STAMPS",
      errorDescription: [
        "Found multiple stamps. This is likely because the content was manually updated.",
        "`codestamp` needs to bail out because it cannot guarantee a deterministic update.",
        "Please regenerate the file.",
      ].join(" "),
      stampList: matchList.map((item) => nullThrows(item?.groups?.stamp)),
    };
  } else {
    // "UPDATE"
    newContentWithPlaceholderStamp = updateStamp({
      content: targetContent,
      newStamp: PLACEHOLDER_STAMP,
    });

    if (initialStampPlacer != null) {
      // Attempt to rewrite the stamp placement from default -> custom

      const contentWithoutDefaultStamp = newContentWithPlaceholderStamp.replace(
        defaultInitialStampPlacer({ content: "", stamp: PLACEHOLDER_STAMP }),
        ""
      );

      if (contentWithoutDefaultStamp !== newContentWithPlaceholderStamp) {
        // Great, the previous stamp placement was the default one.
        // Remove it and apply the new stamp placer
        const maybeResult = applyPlacer({
          content: contentWithoutDefaultStamp,
          stamp: PLACEHOLDER_STAMP,
          placer: initialStampPlacer,
        });

        if (!maybeResult.ok) {
          return maybeResult.error;
        }

        newContentWithPlaceholderStamp = maybeResult.value;
      }
    }
  }

  // Compute new hash
  const newStamp = getHashedStamp(
    JSON.stringify([
      ...dependencyContentList,
      contentTransformerForHashing({
        content: newContentWithPlaceholderStamp,
        stamp: PLACEHOLDER_STAMP,
      }),
    ])
  );

  const newContent = updateStamp({
    content: newContentWithPlaceholderStamp,
    newStamp,
  });

  if (newContent === targetContent) {
    return {
      status: "OK",
      stamp: newStamp,
    };
  }

  if (matchList.length < 1) {
    return {
      status: "NEW",
      newStamp,
      newContent,
    };
  }

  const matchItem = matchList[0];
  return {
    status: "UPDATE",
    newStamp,
    oldStamp: nullThrows(matchItem?.groups?.stamp),
    newContent,
  };
}

type MaybeResult<V, E> =
  | { ok: true; value: V }
  //
  | { ok: false; error: E };

function applyPlacer({
  content,
  stamp,
  placer,
}: {
  content: string;
  stamp: string;
  placer: TStampPlacer | undefined;
}): MaybeResult<
  string,
  Extract<TApplyStampResult, { status: "ERROR"; errorType: "STAMP_PLACER" }>
> {
  let resolvedPlacer: TStampPlacerFn;

  if (placer === undefined) {
    resolvedPlacer = defaultInitialStampPlacer;
  } else if (typeof placer === "string") {
    resolvedPlacer = getStampPlacerFromTemplate(placer);
  } else if (typeof placer === "function") {
    resolvedPlacer = placer;
  } else {
    return {
      ok: false,
      error: {
        status: "ERROR",
        errorType: "STAMP_PLACER",
        errorDescription: "`initialStampPlacer` is not a string or a function.",
        placer: String(placer),
        placerReturnValue: undefined,
      },
    };
  }

  const placerReturnValue = resolvedPlacer({ content, stamp });

  if (typeof placerReturnValue !== "string") {
    return {
      ok: false,
      error: {
        status: "ERROR",
        errorType: "STAMP_PLACER",
        errorDescription: "`initialStampPlacer` didn't return a stamp.",
        placer: String(placer),
        placerReturnValue,
      },
    };
  }

  const matchList = [...placerReturnValue.matchAll(STAMP_REGEX_GLOBAL)];

  if (matchList.length !== 1) {
    return {
      ok: false,
      error: {
        status: "ERROR",
        errorType: "STAMP_PLACER",
        errorDescription:
          matchList.length === 0
            ? "`initialStampPlacer` didn't return a stamp."
            : "`initialStampPlacer` returned multiple stamps.",
        placer: String(placer),
        placerReturnValue,
      },
    };
  }

  return {
    ok: true,
    value: placerReturnValue,
  };
}

// Assumes the content contains a single stamp
function updateStamp({
  content,
  newStamp,
}: {
  content: string;
  newStamp: string;
}): string {
  return content.replace(STAMP_REGEX, newStamp);
}
