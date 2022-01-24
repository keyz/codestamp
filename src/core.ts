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
 * If you update `initialStampPlacer` from another **custom** placer,
 * you must also define `initialStampRemover` ({@link TStampRemover})
 * to instruct how your previous stamp should be removed. Otherwise
 * the format change won't be applied (because `codestamp` doesn't
 * have enough context to make a safe change), although the stamp
 * itself will always be updated correctly.
 *
 * NOTE: A single and complete stamp must be returned as-is from the
 * function or included in the string.
 *
 * - Function type: `({content: string, stamp: string}) => string`.
 * - Template string: A string that contains two special formatters,
 *   `%STAMP%` and `%CONTENT%`. `codestamp` will replace `%STAMP%`
 *   with the stamp, and `%CONTENT%` with the rest of content.
 *
 * NOTE: When `initialStampPlacer` is invoked, it's guaranteed that
 * the value of `content` does not include `stamp`.
 *
 * ```typescript
 * content.indexOf(stamp) === -1 // guaranteed
 * ```
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
export type TStampPlacer = TFormatter | string;

export type TFormatter = ({
  content,
  stamp,
}: {
  content: string;
  stamp: string;
}) => string;

const defaultInitialStampPlacer: TFormatter = ({ content, stamp }) =>
  `/* @generated ${stamp} */\n${content}`;
// <DOCEND SOURCE TStampPlacer>

// <DOCSTART SOURCE TStampRemover>
/**
 * The inverse of `initialStampPlacer` ({@link TStampPlacer}). Use it
 * to remove (and update) a previously applied **custom** stamp (the
 * default stamp will always be removed automatically).
 *
 * If you update `initialStampPlacer` from another custom placer, you
 * must define this function to instruct how your previous stamp
 * should be removed. Otherwise the format change won't be applied,
 * although the stamp itself will always be updated correctly.
 *
 * NOTE: When `initialStampRemover` is invoked, it's guaranteed that
 * the value of `content` includes `stamp`.
 *
 * ```typescript
 * content.indexOf(stamp) !== -1 // guaranteed
 * ```
 *
 * In other words, `initialStampRemover` won't be called if `content`
 * doesn't contain a `stamp` yet.
 *
 * @example Update a custom Python multiline banner comment
 *
 * ```typescript
 * {
 *   initialStampPlacer: ({content, stamp}) => {
 *     return `# GENERATED ${stamp}\n# DO NOT EDIT BY HAND\n${content}`;
 *   },
 *   initialStampRemover: ({content, stamp}) => {
 *     const contentLineList = content.split('\n');
 *     const indexOfStamp = contentLineList.findIndex(
 *       line => line.includes(stamp),
 *     );
 *
 *     contentLineList.splice(indexOfStamp, 2);
 *     return contentLineList.join('\n');
 *   },
 * }
 * ```
 */
export type TStampRemover = TFormatter;
// <DOCEND SOURCE TStampRemover>

const defaultInitialStampRemover: TStampRemover = ({ content, stamp }) => {
  return content.replace(defaultInitialStampPlacer({ content: "", stamp }), "");
};

function resolveStampPlacerFromTemplate(template: string): TFormatter {
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
   * See {@link TStampPlacer} and {@link TStampRemover}.
   *
   * @defaultValue {@link defaultInitialStampPlacer}
   */
  initialStampPlacer?: TStampPlacer;
  /**
   * Use it to remove (and update) a previously applied **custom**
   * stamp. See {@link TStampRemover} and {@link TStampPlacer}.
   */
  initialStampRemover?: TStampRemover;
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
  initialStampRemover,
  contentTransformerForHashing = ({ content }) => content,
}: TApplyStampParam): TApplyStampResult {
  // <DOCEND SOURCE applyStamp>

  let newContentWithPlaceholderStamp: string;

  const stampList = extractStampList(targetContent);

  if (stampList.length === 0) {
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
  } else if (stampList.length > 1) {
    // "ERROR"
    return {
      status: "ERROR",
      errorType: "MULTIPLE_STAMPS",
      errorDescription: [
        "Found multiple stamps. This is likely because the content was manually updated.",
        "`codestamp` needs to bail out because it cannot guarantee a deterministic update.",
        "Please regenerate the file.",
      ].join(" "),
      stampList,
    };
  } else {
    // "UPDATE": stampList.length === 1
    newContentWithPlaceholderStamp = updateStamp({
      content: targetContent,
      newStamp: PLACEHOLDER_STAMP,
    });

    // Attempt to remove the previous stamp
    let maybeContentWithoutPreviousStamp = newContentWithPlaceholderStamp;

    // Always call the default remover first
    maybeContentWithoutPreviousStamp = defaultInitialStampRemover({
      content: maybeContentWithoutPreviousStamp,
      stamp: PLACEHOLDER_STAMP,
    });

    // Invoke `initialStampRemover` if there's still a stamp
    if (
      extractStampList(maybeContentWithoutPreviousStamp).length !== 0 &&
      initialStampRemover != null
    ) {
      maybeContentWithoutPreviousStamp = initialStampRemover({
        content: maybeContentWithoutPreviousStamp,
        stamp: PLACEHOLDER_STAMP,
      });
    }

    if (extractStampList(maybeContentWithoutPreviousStamp).length === 0) {
      // Great, the previous stamp was removed!
      // Apply initial placer again
      const maybeResult = applyPlacer({
        content: maybeContentWithoutPreviousStamp,
        stamp: PLACEHOLDER_STAMP,
        placer: initialStampPlacer,
      });

      if (!maybeResult.ok) {
        return maybeResult.error;
      }

      newContentWithPlaceholderStamp = maybeResult.value;
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

  if (stampList.length < 1) {
    return {
      status: "NEW",
      newStamp,
      newContent,
    };
  }

  const oldStamp = stampList[0];
  return {
    status: "UPDATE",
    newStamp,
    oldStamp: nullThrows(oldStamp),
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
  let resolvedPlacer: TFormatter;

  if (placer === undefined) {
    resolvedPlacer = defaultInitialStampPlacer;
  } else if (typeof placer === "string") {
    resolvedPlacer = resolveStampPlacerFromTemplate(placer);
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

  const stampList = extractStampList(placerReturnValue);

  if (stampList.length !== 1) {
    return {
      ok: false,
      error: {
        status: "ERROR",
        errorType: "STAMP_PLACER",
        errorDescription:
          stampList.length === 0
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

function extractStampList(content: string): Array<string> {
  return [...content.matchAll(STAMP_REGEX_GLOBAL)].map((item) =>
    nullThrows(item?.groups?.stamp)
  );
}
