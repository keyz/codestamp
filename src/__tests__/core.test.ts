import { applyStamp } from "../core";
import type { TApplyStampResult, TApplyStampParam } from "../core";

describe("`applyStamp`: basic", () => {
  test('Returns "NEW" for unstamped content', () => {
    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: "",
      })
    ).toMatchInlineSnapshot(`
      Object {
        "newContent": "/* @generated CodeStamp<<3db23235f1fa40cb21aeb9d2e29c2e28>> */
      ",
        "newStamp": "CodeStamp<<3db23235f1fa40cb21aeb9d2e29c2e28>>",
        "status": "NEW",
      }
    `);

    expect(
      applyStamp({ dependencyContentList: [], targetContent: "content here" })
    ).toMatchInlineSnapshot(`
      Object {
        "newContent": "/* @generated CodeStamp<<0eba33f6cf88e85fbab181e265b83229>> */
      content here",
        "newStamp": "CodeStamp<<0eba33f6cf88e85fbab181e265b83229>>",
        "status": "NEW",
      }
    `);

    expect(
      applyStamp({
        dependencyContentList: ["a", "b", "c"],
        targetContent: "content here",
      })
    ).toMatchInlineSnapshot(`
      Object {
        "newContent": "/* @generated CodeStamp<<c1aa4ff2ac747d1192773354ad64d122>> */
      content here",
        "newStamp": "CodeStamp<<c1aa4ff2ac747d1192773354ad64d122>>",
        "status": "NEW",
      }
    `);
  });

  test('Returns "UPDATE" for outdated stamp', () => {
    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: `/* @generated CodeStamp<<123456>> */\ncontent here\n`,
      })
    ).toMatchInlineSnapshot(`
      Object {
        "newContent": "/* @generated CodeStamp<<64adca472a2638d8c915fb5d83c688f7>> */
      content here
      ",
        "newStamp": "CodeStamp<<64adca472a2638d8c915fb5d83c688f7>>",
        "oldStamp": "CodeStamp<<123456>>",
        "status": "UPDATE",
      }
    `);

    expect(
      applyStamp({
        dependencyContentList: ["a", "b", "c"],
        targetContent: `/* @generated CodeStamp<<123456>> */\ncontent here\n`,
      })
    ).toMatchInlineSnapshot(`
      Object {
        "newContent": "/* @generated CodeStamp<<16ed32a8d035e3a01429c7c1eed9dc87>> */
      content here
      ",
        "newStamp": "CodeStamp<<16ed32a8d035e3a01429c7c1eed9dc87>>",
        "oldStamp": "CodeStamp<<123456>>",
        "status": "UPDATE",
      }
    `);

    expect(
      applyStamp({
        dependencyContentList: ["a", "b", "c"],
        targetContent: `foo\n  bar CodeStamp<<123>> \ncool`,
      })
    ).toMatchInlineSnapshot(`
      Object {
        "newContent": "foo
        bar CodeStamp<<9c6bef418291499f303bf9cc535310ef>> 
      cool",
        "newStamp": "CodeStamp<<9c6bef418291499f303bf9cc535310ef>>",
        "oldStamp": "CodeStamp<<123>>",
        "status": "UPDATE",
      }
    `);
  });

  test("Outdated stamp does not affect new stamp", () => {
    expect(
      throwIfNoNewContent(
        applyStamp({
          dependencyContentList: [],
          targetContent: `/* @generated CodeStamp<<123456>> */\ncontent here\n`,
        })
      ).newContent
    ).toStrictEqual(
      throwIfNoNewContent(
        applyStamp({
          dependencyContentList: [],
          targetContent: `/* @generated CodeStamp<<88>> */\ncontent here\n`,
        })
      ).newContent
    );

    expect(
      throwIfNoNewContent(
        applyStamp({
          dependencyContentList: ["a", "b", "c"],
          targetContent: `/* @generated CodeStamp<<123456>> */\ncontent here\n`,
        })
      ).newContent
    ).toStrictEqual(
      throwIfNoNewContent(
        applyStamp({
          dependencyContentList: ["a", "b", "c"],
          targetContent: `/* @generated CodeStamp<<88>> */\ncontent here\n`,
        })
      ).newContent
    );
  });
});

describe("`applyStamp`: `initialStampPlacer`", () => {
  test("Valid custom `initialStampPlacer` function", () => {
    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: "",
        initialStampPlacer: ({ content, stamp }) => `// ${stamp}\n${content}`,
      })
    ).toMatchInlineSnapshot(`
      Object {
        "newContent": "// CodeStamp<<be9ad60d6e1be298afc5de77308c1378>>
      ",
        "newStamp": "CodeStamp<<be9ad60d6e1be298afc5de77308c1378>>",
        "status": "NEW",
      }
    `);

    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        initialStampPlacer: ({ content, stamp }) =>
          `// @codegen ${stamp}\n${content}`,
      })
    ).toMatchInlineSnapshot(`
      Object {
        "newContent": "// @codegen CodeStamp<<c9bae03807f38d898a2e20f8945fac6a>>
      foobar",
        "newStamp": "CodeStamp<<c9bae03807f38d898a2e20f8945fac6a>>",
        "status": "NEW",
      }
    `);

    expect(
      applyStamp({
        dependencyContentList: ["a", "b", "c"],
        targetContent: "foobar",
        initialStampPlacer: ({ content, stamp }) =>
          `// @codegen ${stamp}\n${content}`,
      })
    ).toMatchInlineSnapshot(`
      Object {
        "newContent": "// @codegen CodeStamp<<011e0f33fb4a756f0aac7236a6fde339>>
      foobar",
        "newStamp": "CodeStamp<<011e0f33fb4a756f0aac7236a6fde339>>",
        "status": "NEW",
      }
    `);

    // This is useless, but ok
    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        initialStampPlacer: ({ stamp }) => stamp,
      })
    ).toMatchInlineSnapshot(`
      Object {
        "newContent": "CodeStamp<<96aa20428fe36dd98bc23dade3fb5c47>>",
        "newStamp": "CodeStamp<<96aa20428fe36dd98bc23dade3fb5c47>>",
        "status": "NEW",
      }
    `);
  });

  test("Invalid custom `initialStampPlacer` function", () => {
    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        initialStampPlacer: 123 as any,
      })
    ).toMatchInlineSnapshot(`
      Object {
        "errorDescription": "\`initialStampPlacer\` is not a string or a function.",
        "errorType": "STAMP_PLACER",
        "placer": "123",
        "placerReturnValue": undefined,
        "status": "ERROR",
      }
    `);
    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        initialStampPlacer: () => "",
      })
    ).toMatchInlineSnapshot(`
      Object {
        "errorDescription": "\`initialStampPlacer\` didn't return a stamp.",
        "errorType": "STAMP_PLACER",
        "placer": "() => \\"\\"",
        "placerReturnValue": "",
        "status": "ERROR",
      }
    `);
    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        initialStampPlacer: () => undefined as any,
      })
    ).toMatchInlineSnapshot(`
      Object {
        "errorDescription": "\`initialStampPlacer\` didn't return a stamp.",
        "errorType": "STAMP_PLACER",
        "placer": "() => undefined",
        "placerReturnValue": undefined,
        "status": "ERROR",
      }
    `);
    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        initialStampPlacer: () => null as any,
      })
    ).toMatchInlineSnapshot(`
      Object {
        "errorDescription": "\`initialStampPlacer\` didn't return a stamp.",
        "errorType": "STAMP_PLACER",
        "placer": "() => null",
        "placerReturnValue": null,
        "status": "ERROR",
      }
    `);
    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        initialStampPlacer: ({ content }) => content,
      })
    ).toMatchInlineSnapshot(`
      Object {
        "errorDescription": "\`initialStampPlacer\` didn't return a stamp.",
        "errorType": "STAMP_PLACER",
        "placer": "({
              content
            }) => content",
        "placerReturnValue": "foobar",
        "status": "ERROR",
      }
    `);
    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        initialStampPlacer: ({ content, stamp }) =>
          `${content} ${stamp.substring(0, stamp.length - 1)}`,
      })
    ).toMatchInlineSnapshot(`
      Object {
        "errorDescription": "\`initialStampPlacer\` didn't return a stamp.",
        "errorType": "STAMP_PLACER",
        "placer": "({
              content,
              stamp
            }) => \`\${content} \${stamp.substring(0, stamp.length - 1)}\`",
        "placerReturnValue": "foobar CodeStamp<<4097889236a2af26c293033feb964c4c>",
        "status": "ERROR",
      }
    `);

    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        initialStampPlacer: ({ stamp }) => `${stamp}${stamp}`,
      })
    ).toMatchInlineSnapshot(`
      Object {
        "errorDescription": "\`initialStampPlacer\` returned multiple stamps.",
        "errorType": "STAMP_PLACER",
        "placer": "({
              stamp
            }) => \`\${stamp}\${stamp}\`",
        "placerReturnValue": "CodeStamp<<4097889236a2af26c293033feb964c4c>>CodeStamp<<4097889236a2af26c293033feb964c4c>>",
        "status": "ERROR",
      }
    `);
  });

  test("Valid custom `initialStampPlacer` string template", () => {
    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: "",
        initialStampPlacer: `// %STAMP%\n%CONTENT%`,
      })
    ).toStrictEqual(
      applyStamp({
        dependencyContentList: [],
        targetContent: "",
        initialStampPlacer: ({ content, stamp }) => `// ${stamp}\n${content}`,
      })
    );

    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        initialStampPlacer: `// @codegen %STAMP%\n%CONTENT%`,
      })
    ).toStrictEqual(
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        initialStampPlacer: ({ content, stamp }) =>
          `// @codegen ${stamp}\n${content}`,
      })
    );

    expect(
      applyStamp({
        dependencyContentList: ["a", "b", "c"],
        targetContent: "foobar",
        initialStampPlacer: `// YO!!! %here%%STAMP%%hello%\n%nihao%CONTENT%good%\n\n`,
      })
    ).toStrictEqual(
      applyStamp({
        dependencyContentList: ["a", "b", "c"],
        targetContent: "foobar",
        initialStampPlacer: ({ content, stamp }) =>
          `// YO!!! %here%${stamp}%hello%\n%nihao${content}good%\n\n`,
      })
    );

    // This is useless, but ok
    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        initialStampPlacer: "%STAMP%",
      })
    ).toStrictEqual(
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        initialStampPlacer: ({ stamp }) => stamp,
      })
    );
  });

  test("InValid custom `initialStampPlacer` string template", () => {
    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        initialStampPlacer: "",
      })
    ).toMatchInlineSnapshot(`
      Object {
        "errorDescription": "\`initialStampPlacer\` didn't return a stamp.",
        "errorType": "STAMP_PLACER",
        "placer": "",
        "placerReturnValue": "",
        "status": "ERROR",
      }
    `);

    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        initialStampPlacer: "does not work",
      })
    ).toMatchInlineSnapshot(`
      Object {
        "errorDescription": "\`initialStampPlacer\` didn't return a stamp.",
        "errorType": "STAMP_PLACER",
        "placer": "does not work",
        "placerReturnValue": "does not work",
        "status": "ERROR",
      }
    `);

    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        initialStampPlacer: "only %CONTENT% no",
      })
    ).toMatchInlineSnapshot(`
      Object {
        "errorDescription": "\`initialStampPlacer\` didn't return a stamp.",
        "errorType": "STAMP_PLACER",
        "placer": "only %CONTENT% no",
        "placerReturnValue": "only foobar no",
        "status": "ERROR",
      }
    `);

    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        initialStampPlacer: "%STAMP% %STAMP%",
      })
    ).toMatchInlineSnapshot(`
      Object {
        "errorDescription": "\`initialStampPlacer\` returned multiple stamps.",
        "errorType": "STAMP_PLACER",
        "placer": "%STAMP% %STAMP%",
        "placerReturnValue": "CodeStamp<<4097889236a2af26c293033feb964c4c>> CodeStamp<<4097889236a2af26c293033feb964c4c>>",
        "status": "ERROR",
      }
    `);
  });
});

describe("`applyStamp`: `contentTransformerForHashing`", () => {
  test("`contentTransformerForHashing` allows the stamp to be unaffected by formatting", () => {
    const input: TApplyStampParam = {
      dependencyContentList: ["a", "b", "c"],
      targetContent: '{"foo": "bar"}\n',
      contentTransformerForHashing: ({ content }) =>
        // Ignores spacing and new lines for hashing
        JSON.stringify(JSON.parse(content)),
      initialStampPlacer: ({ content, stamp }) => {
        // Dynamically place the stamp as a JSON field
        const stampedObject = { ...JSON.parse(content), stamp };
        // Insert new lines
        return JSON.stringify(stampedObject, null, 2);
      },
    };

    const result1 = applyStamp(input);

    expect(result1).toMatchInlineSnapshot(`
      Object {
        "newContent": "{
        \\"foo\\": \\"bar\\",
        \\"stamp\\": \\"CodeStamp<<4386559551a924b43d532c122a14ce6c>>\\"
      }",
        "newStamp": "CodeStamp<<4386559551a924b43d532c122a14ce6c>>",
        "status": "NEW",
      }
    `);

    const result2 = applyStamp({
      ...input,
      targetContent: `
        {
          "foo":     "bar"
        }
      `,
      initialStampPlacer: ({ content, stamp }) => {
        const stampedObject = { ...JSON.parse(content), stamp };
        // No new lines
        return JSON.stringify(stampedObject);
      },
    });

    expect(result2).toMatchInlineSnapshot(`
      Object {
        "newContent": "{\\"foo\\":\\"bar\\",\\"stamp\\":\\"CodeStamp<<4386559551a924b43d532c122a14ce6c>>\\"}",
        "newStamp": "CodeStamp<<4386559551a924b43d532c122a14ce6c>>",
        "status": "NEW",
      }
    `);

    expect(throwIfNoNewContent(result1).newStamp).toStrictEqual(
      throwIfNoNewContent(result2).newStamp
    );
  });

  test("`contentTransformerForHashing` only applies to hashing, not the format of the final output", () => {
    const input: TApplyStampParam = {
      dependencyContentList: [],
      targetContent: "hello",
      contentTransformerForHashing: ({ content, stamp }) =>
        // Always exclude the stamp line from hashing
        content
          .split("\n")
          .filter((line) => !line.includes(stamp))
          .join("\n"),
    };

    const result1 = applyStamp(input);

    const result2 = applyStamp({
      ...input,
      initialStampPlacer: ({ content, stamp }) =>
        `// SOMETHING DIFFERENT ${stamp}\n${content}`,
    });

    expect(result1).toMatchInlineSnapshot(`
      Object {
        "newContent": "/* @generated CodeStamp<<c7a0f7154e64cd96c617f251dc12c439>> */
      hello",
        "newStamp": "CodeStamp<<c7a0f7154e64cd96c617f251dc12c439>>",
        "status": "NEW",
      }
    `);

    expect(result2).toMatchInlineSnapshot(`
      Object {
        "newContent": "// SOMETHING DIFFERENT CodeStamp<<c7a0f7154e64cd96c617f251dc12c439>>
      hello",
        "newStamp": "CodeStamp<<c7a0f7154e64cd96c617f251dc12c439>>",
        "status": "NEW",
      }
    `);

    expect(throwIfNoNewContent(result1).newStamp).toStrictEqual(
      throwIfNoNewContent(result2).newStamp
    );
  });
});

describe("Multiple stamps", () => {
  test("`applyStamp` returns `error`", () => {
    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: "foo\nCodeStamp<<111>>\ncool\nCodeStamp<<222>>\nbar",
      })
    ).toMatchInlineSnapshot(`
      Object {
        "errorDescription": "Found multiple stamps. This is likely because the content was manually updated. \`codestamp\` needs to bail out because it cannot guarantee a deterministic update. Please regenerate the file.",
        "errorType": "MULTIPLE_STAMPS",
        "stampList": Array [
          "CodeStamp<<111>>",
          "CodeStamp<<222>>",
        ],
        "status": "ERROR",
      }
    `);

    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: "CodeStamp<<111>>CodeStamp<<222>>",
      })
    ).toMatchInlineSnapshot(`
      Object {
        "errorDescription": "Found multiple stamps. This is likely because the content was manually updated. \`codestamp\` needs to bail out because it cannot guarantee a deterministic update. Please regenerate the file.",
        "errorType": "MULTIPLE_STAMPS",
        "stampList": Array [
          "CodeStamp<<111>>",
          "CodeStamp<<222>>",
        ],
        "status": "ERROR",
      }
    `);
  });
});

describe("E2E", () => {
  test("`applyStamp` is deterministic", () => {
    // NEW
    const result1 = applyStamp({
      dependencyContentList: [],
      targetContent: "hello",
    });
    const output1 = throwIfNoNewContent(result1).newContent;

    expect(result1).toMatchInlineSnapshot(`
      Object {
        "newContent": "/* @generated CodeStamp<<bca801235b53ad8de2380789961aa484>> */
      hello",
        "newStamp": "CodeStamp<<bca801235b53ad8de2380789961aa484>>",
        "status": "NEW",
      }
    `);

    // OK
    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: output1,
      })
    ).toMatchInlineSnapshot(`
      Object {
        "stamp": "CodeStamp<<bca801235b53ad8de2380789961aa484>>",
        "status": "OK",
      }
    `);

    // UPDATE
    const result2 = applyStamp({
      dependencyContentList: ["foo"],
      targetContent: output1,
    });
    const output2 = throwIfNoNewContent(result2).newContent;

    expect(result2).toMatchInlineSnapshot(`
      Object {
        "newContent": "/* @generated CodeStamp<<a0e9327ee2cbe366ecb33bf74d2e1644>> */
      hello",
        "newStamp": "CodeStamp<<a0e9327ee2cbe366ecb33bf74d2e1644>>",
        "oldStamp": "CodeStamp<<bca801235b53ad8de2380789961aa484>>",
        "status": "UPDATE",
      }
    `);

    // OK
    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: output2,
      })
    ).toMatchInlineSnapshot(`
      Object {
        "newContent": "/* @generated CodeStamp<<bca801235b53ad8de2380789961aa484>> */
      hello",
        "newStamp": "CodeStamp<<bca801235b53ad8de2380789961aa484>>",
        "oldStamp": "CodeStamp<<a0e9327ee2cbe366ecb33bf74d2e1644>>",
        "status": "UPDATE",
      }
    `);

    // UPDATE (back to result 1)
    const result3 = applyStamp({
      dependencyContentList: [],
      targetContent: output2,
    });
    const output3 = throwIfNoNewContent(result3).newContent;

    expect(result3).toMatchInlineSnapshot(`
      Object {
        "newContent": "/* @generated CodeStamp<<bca801235b53ad8de2380789961aa484>> */
      hello",
        "newStamp": "CodeStamp<<bca801235b53ad8de2380789961aa484>>",
        "oldStamp": "CodeStamp<<a0e9327ee2cbe366ecb33bf74d2e1644>>",
        "status": "UPDATE",
      }
    `);
    expect(output3).toStrictEqual(output1);
  });

  test("`applyStamp` gracefully updates the default stamp placement", () => {
    const result1 = applyStamp({
      dependencyContentList: [],
      targetContent: "hello",
    });
    const output1 = throwIfNoNewContent(result1).newContent;

    expect(result1).toMatchInlineSnapshot(`
      Object {
        "newContent": "/* @generated CodeStamp<<bca801235b53ad8de2380789961aa484>> */
      hello",
        "newStamp": "CodeStamp<<bca801235b53ad8de2380789961aa484>>",
        "status": "NEW",
      }
    `);

    // New stamp placement (default -> custom)
    const result2 = applyStamp({
      dependencyContentList: ["ok"],
      targetContent: output1,
      initialStampPlacer: ({ content, stamp }) =>
        `// MY CUSTOM ${stamp}\n${content}`,
    });
    const output2 = throwIfNoNewContent(result2).newContent;

    expect(result2).toMatchInlineSnapshot(`
      Object {
        "newContent": "// MY CUSTOM CodeStamp<<04c1e1592377ffac3591df9dd7dc323c>>
      hello",
        "newStamp": "CodeStamp<<04c1e1592377ffac3591df9dd7dc323c>>",
        "oldStamp": "CodeStamp<<bca801235b53ad8de2380789961aa484>>",
        "status": "UPDATE",
      }
    `);

    // New stamp placement (default -> custom)
    const result2FromTemplate = applyStamp({
      dependencyContentList: ["ok"],
      targetContent: output1,
      initialStampPlacer: `// MY CUSTOM %STAMP%\n%CONTENT%`,
    });
    const output2FromTemplate =
      throwIfNoNewContent(result2FromTemplate).newContent;

    expect(result2FromTemplate).toMatchInlineSnapshot(`
      Object {
        "newContent": "// MY CUSTOM CodeStamp<<04c1e1592377ffac3591df9dd7dc323c>>
      hello",
        "newStamp": "CodeStamp<<04c1e1592377ffac3591df9dd7dc323c>>",
        "oldStamp": "CodeStamp<<bca801235b53ad8de2380789961aa484>>",
        "status": "UPDATE",
      }
    `);
    expect(output2FromTemplate).toStrictEqual(output2);

    // New stamp placement (default -> custom), but template is bad
    expect(
      applyStamp({
        dependencyContentList: ["ok"],
        targetContent: output1,
        initialStampPlacer: ({ stamp }) => `${stamp} ${stamp}`,
      })
    ).toMatchInlineSnapshot(`
      Object {
        "errorDescription": "\`initialStampPlacer\` returned multiple stamps.",
        "errorType": "STAMP_PLACER",
        "placer": "({
              stamp
            }) => \`\${stamp} \${stamp}\`",
        "placerReturnValue": "CodeStamp<<4097889236a2af26c293033feb964c4c>> CodeStamp<<4097889236a2af26c293033feb964c4c>>",
        "status": "ERROR",
      }
    `);

    // NOTE: The stamp placement CAN'T BE UPDATED from custom -> custom
    // Because we don't have enough information to deterministically revert or restore the content
    const result3 = applyStamp({
      dependencyContentList: ["cool", "cool"],
      targetContent: output2,
      initialStampPlacer: ({ content, stamp }) =>
        `// THIS WON'T BE APPLIED ${stamp}\n${content}`,
    });
    const output3 = throwIfNoNewContent(result3).newContent;

    expect(output3).toMatchInlineSnapshot(`
      "// MY CUSTOM CodeStamp<<f240c52d298ee98a46e4b6ca25c5e15e>>
      hello"
    `);

    // Although the format won't change, the existing stamp will always be updated correctly
    const result4 = applyStamp({
      dependencyContentList: ["ok"],
      targetContent: output3,
      initialStampPlacer: ({ content, stamp }) =>
        `// THIS WON'T BE APPLIED ${stamp}\n${content}`,
    });
    const output4 = throwIfNoNewContent(result4).newContent;

    expect(output4).toStrictEqual(output2);
  });
});

function throwIfNoNewContent(
  input: TApplyStampResult
): Extract<TApplyStampResult, { status: "NEW" } | { status: "UPDATE" }> {
  if (input.status !== "NEW" && input.status !== "UPDATE") {
    throw new Error(`Not "NEW" or "UPDATE": ${JSON.stringify(input)}`);
  }

  return input;
}
