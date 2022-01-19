import { verifyStamp, applyStamp } from "../core";

describe("`applyStamp`", () => {
  test("Handles unstamped content", () => {
    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: "",
      })
    ).toMatchInlineSnapshot(`
      "/* @generated CodeStamp<<3db23235f1fa40cb21aeb9d2e29c2e28>> */
      "
    `);

    expect(
      applyStamp({ dependencyContentList: [], targetContent: "content here" })
    ).toMatchInlineSnapshot(`
      "/* @generated CodeStamp<<0eba33f6cf88e85fbab181e265b83229>> */
      content here"
    `);

    expect(
      applyStamp({
        dependencyContentList: ["a", "b", "c"],
        targetContent: "content here",
      })
    ).toMatchInlineSnapshot(`
      "/* @generated CodeStamp<<c1aa4ff2ac747d1192773354ad64d122>> */
      content here"
    `);
  });

  test("Updates outdated stamp", () => {
    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: `/* @generated CodeStamp<<123456>> */\ncontent here\n`,
      })
    ).toMatchInlineSnapshot(`
      "/* @generated CodeStamp<<64adca472a2638d8c915fb5d83c688f7>> */
      content here
      "
    `);

    expect(
      applyStamp({
        dependencyContentList: ["a", "b", "c"],
        targetContent: `/* @generated CodeStamp<<123456>> */\ncontent here\n`,
      })
    ).toMatchInlineSnapshot(`
      "/* @generated CodeStamp<<16ed32a8d035e3a01429c7c1eed9dc87>> */
      content here
      "
    `);

    expect(
      applyStamp({
        dependencyContentList: ["a", "b", "c"],
        targetContent: `foo\n  bar CodeStamp<<123>> \ncool`,
      })
    ).toMatchInlineSnapshot(`
      "foo
        bar CodeStamp<<9c6bef418291499f303bf9cc535310ef>> 
      cool"
    `);
  });

  test("Outdated stamp does not affect new stamp", () => {
    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: `/* @generated CodeStamp<<123456>> */\ncontent here\n`,
      })
    ).toStrictEqual(
      applyStamp({
        dependencyContentList: [],
        targetContent: `/* @generated CodeStamp<<88>> */\ncontent here\n`,
      })
    );

    expect(
      applyStamp({
        dependencyContentList: ["a", "b", "c"],
        targetContent: `/* @generated CodeStamp<<123456>> */\ncontent here\n`,
      })
    ).toStrictEqual(
      applyStamp({
        dependencyContentList: ["a", "b", "c"],
        targetContent: `/* @generated CodeStamp<<88>> */\ncontent here\n`,
      })
    );
  });

  test("Custom `placeInitialStamp` function", () => {
    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: "",
        placeInitialStamp: ({ content, stamp }) => `// ${stamp}\n${content}`,
      })
    ).toMatchInlineSnapshot(`
      "// CodeStamp<<be9ad60d6e1be298afc5de77308c1378>>
      "
    `);

    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        placeInitialStamp: ({ content, stamp }) =>
          `// @codegen ${stamp}\n${content}`,
      })
    ).toMatchInlineSnapshot(`
      "// @codegen CodeStamp<<c9bae03807f38d898a2e20f8945fac6a>>
      foobar"
    `);

    expect(
      applyStamp({
        dependencyContentList: ["a", "b", "c"],
        targetContent: "foobar",
        placeInitialStamp: ({ content, stamp }) =>
          `// @codegen ${stamp}\n${content}`,
      })
    ).toMatchInlineSnapshot(`
      "// @codegen CodeStamp<<011e0f33fb4a756f0aac7236a6fde339>>
      foobar"
    `);

    // This is useless, but ok
    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        placeInitialStamp: ({ stamp }) => stamp,
      })
    ).toMatchInlineSnapshot(`"CodeStamp<<96aa20428fe36dd98bc23dade3fb5c47>>"`);

    expect(() =>
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        placeInitialStamp: () => "",
      })
    ).toThrowErrorMatchingInlineSnapshot(`
      "CodeStamp: \`placeInitialStamp(...)\` must return a string that contains the stamp.
      Return value: \\"\\""
    `);
    expect(() =>
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        placeInitialStamp: () => undefined as any,
      })
    ).toThrowErrorMatchingInlineSnapshot(`
      "CodeStamp: \`placeInitialStamp(...)\` must return a string that contains the stamp.
      Return value: undefined"
    `);
    expect(() =>
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        placeInitialStamp: () => null as any,
      })
    ).toThrowErrorMatchingInlineSnapshot(`
      "CodeStamp: \`placeInitialStamp(...)\` must return a string that contains the stamp.
      Return value: null"
    `);
    expect(() =>
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        placeInitialStamp: ({ content }) => content,
      })
    ).toThrowErrorMatchingInlineSnapshot(`
      "CodeStamp: \`placeInitialStamp(...)\` must return a string that contains the stamp.
      Return value: \\"foobar\\""
    `);
    expect(() =>
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        placeInitialStamp: ({ content, stamp }) =>
          `${content} ${stamp.substring(0, stamp.length - 1)}`,
      })
    ).toThrowErrorMatchingInlineSnapshot(`
      "CodeStamp: \`placeInitialStamp(...)\` must return a string that contains the stamp.
      Return value: \\"foobar CodeStamp<<4097889236a2af26c293033feb964c4c>\\""
    `);
  });

  test("Custom `placeInitialStamp` string template", () => {
    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: "",
        placeInitialStamp: `// %STAMP%\n%CONTENT%`,
      })
    ).toStrictEqual(
      applyStamp({
        dependencyContentList: [],
        targetContent: "",
        placeInitialStamp: ({ content, stamp }) => `// ${stamp}\n${content}`,
      })
    );

    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        placeInitialStamp: `// @codegen %STAMP%\n%CONTENT%`,
      })
    ).toStrictEqual(
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        placeInitialStamp: ({ content, stamp }) =>
          `// @codegen ${stamp}\n${content}`,
      })
    );

    expect(
      applyStamp({
        dependencyContentList: ["a", "b", "c"],
        targetContent: "foobar",
        placeInitialStamp: `// YO!!! %here%%STAMP%%hello%\n%nihao%CONTENT%good%\n\n`,
      })
    ).toStrictEqual(
      applyStamp({
        dependencyContentList: ["a", "b", "c"],
        targetContent: "foobar",
        placeInitialStamp: ({ content, stamp }) =>
          `// YO!!! %here%${stamp}%hello%\n%nihao${content}good%\n\n`,
      })
    );

    // This is useless, but ok
    expect(
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        placeInitialStamp: "%STAMP%",
      })
    ).toStrictEqual(
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        placeInitialStamp: ({ stamp }) => stamp,
      })
    );

    expect(() =>
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        placeInitialStamp: "",
      })
    ).toThrowErrorMatchingInlineSnapshot(`
      "CodeStamp: \`placeInitialStamp\` must contain the stamp.
      Template: \\"\\"
      Return value: \\"\\""
    `);

    expect(() =>
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        placeInitialStamp: "does not work",
      })
    ).toThrowErrorMatchingInlineSnapshot(`
      "CodeStamp: \`placeInitialStamp\` must contain the stamp.
      Template: \\"does not work\\"
      Return value: \\"does not work\\""
    `);

    expect(() =>
      applyStamp({
        dependencyContentList: [],
        targetContent: "foobar",
        placeInitialStamp: "only %CONTENT% no",
      })
    ).toThrowErrorMatchingInlineSnapshot(`
      "CodeStamp: \`placeInitialStamp\` must contain the stamp.
      Template: \\"only %CONTENT% no\\"
      Return value: \\"only foobar no\\""
    `);
  });
});

describe("`verifyStamp`", () => {
  test("Throws when there's no stamp", () => {
    expect(() =>
      verifyStamp({ dependencyContentList: [], targetContent: "" })
    ).toThrowErrorMatchingInlineSnapshot(
      `"CodeStamp: Unable to find stamp in \\"\\""`
    );
    expect(() =>
      verifyStamp({ dependencyContentList: [], targetContent: "dummy" })
    ).toThrowErrorMatchingInlineSnapshot(
      `"CodeStamp: Unable to find stamp in \\"dummy\\""`
    );
    expect(() =>
      verifyStamp({ dependencyContentList: [], targetContent: "CodeStamp<<>>" })
    ).toThrowErrorMatchingInlineSnapshot(
      `"CodeStamp: Unable to find stamp in \\"CodeStamp<<>>\\""`
    );
  });

  test("Throws when stamps don't match", () => {
    expect(() =>
      verifyStamp({
        dependencyContentList: [],
        targetContent: "CodeStamp<<123>>",
      })
    ).toThrowErrorMatchingInlineSnapshot(`
      "CodeStamp: Stamps don't match.
      Expected: \\"96aa20428fe36dd98bc23dade3fb5c47\\"
      Received: \\"123\\""
    `);
    expect(() =>
      verifyStamp({
        dependencyContentList: ["a", "b", "c"],
        targetContent: "CodeStamp<<123>>",
      })
    ).toThrowErrorMatchingInlineSnapshot(`
      "CodeStamp: Stamps don't match.
      Expected: \\"c2bc05f0d406fdc32e9bd617b5b0903a\\"
      Received: \\"123\\""
    `);
    expect(() =>
      verifyStamp({
        dependencyContentList: ["a", "b", "c"],
        targetContent: "foo\n  bar CodeStamp<<123>> \ncool",
      })
    ).toThrowErrorMatchingInlineSnapshot(`
      "CodeStamp: Stamps don't match.
      Expected: \\"9c6bef418291499f303bf9cc535310ef\\"
      Received: \\"123\\""
    `);

    expect(() =>
      verifyStamp({
        dependencyContentList: [],
        targetContent: applyStamp({
          dependencyContentList: ["a", "b", "c"],
          targetContent: "content here",
        }),
      })
    ).toThrowErrorMatchingInlineSnapshot(`
      "CodeStamp: Stamps don't match.
      Expected: \\"0eba33f6cf88e85fbab181e265b83229\\"
      Received: \\"c1aa4ff2ac747d1192773354ad64d122\\""
    `);

    expect(() =>
      verifyStamp({
        dependencyContentList: ["a", "b", "c"],
        targetContent: applyStamp({
          dependencyContentList: ["a", "b"],
          targetContent: "content here",
        }),
      })
    ).toThrowErrorMatchingInlineSnapshot(`
      "CodeStamp: Stamps don't match.
      Expected: \\"c1aa4ff2ac747d1192773354ad64d122\\"
      Received: \\"9aacee3b9161dec0bed4e83d72024ee7\\""
    `);
  });

  test("Returns (void) when stamps match", () => {
    function verifyAppliedStamp({
      dependencyContentList,
      targetContent,
    }: {
      dependencyContentList: Array<string>;
      targetContent: string;
    }): void {
      verifyStamp({
        dependencyContentList,
        targetContent: applyStamp({ dependencyContentList, targetContent }),
      });
    }

    expect(() =>
      verifyAppliedStamp({ dependencyContentList: [], targetContent: "" })
    ).not.toThrow();

    expect(() =>
      verifyAppliedStamp({
        dependencyContentList: [],
        targetContent: "content here",
      })
    ).not.toThrow();

    expect(() =>
      verifyAppliedStamp({
        dependencyContentList: ["a", "b", "c"],
        targetContent: "",
      })
    ).not.toThrow();

    expect(() =>
      verifyAppliedStamp({
        dependencyContentList: ["a", "b", "c"],
        targetContent: "content here",
      })
    ).not.toThrow();

    expect(() =>
      verifyAppliedStamp({
        dependencyContentList: ["a", "b", "okok"],
        targetContent: "foo\n  bar \ncool",
      })
    ).not.toThrow();
  });
});

describe("Multiple stamps", () => {
  test("`verifyStamp` throws", () => {
    expect(() =>
      verifyStamp({
        dependencyContentList: [],
        targetContent: "foo\nCodeStamp<<111>>\ncool\nCodeStamp<<222>>\nbar",
      })
    ).toThrowErrorMatchingInlineSnapshot(`
      "CodeStamp: Found multiple stamps. This is likely because you manually updated the content. Please regenerate the file.
      Stamps: \\"<<111>>\\", \\"<<222>>\\"
      Content: \\"foo\\\\nCodeStamp<<111>>\\\\ncool\\\\nCodeStamp<<222>>\\\\nbar\\""
    `);

    expect(() =>
      verifyStamp({
        dependencyContentList: [],
        targetContent: "CodeStamp<<111>>CodeStamp<<222>>",
      })
    ).toThrowErrorMatchingInlineSnapshot(`
      "CodeStamp: Found multiple stamps. This is likely because you manually updated the content. Please regenerate the file.
      Stamps: \\"<<111>>\\", \\"<<222>>\\"
      Content: \\"CodeStamp<<111>>CodeStamp<<222>>\\""
    `);
  });
});

describe("E2E", () => {
  test("`applyStamp` and `verifyStamp` are deterministic", () => {
    const output1 = applyStamp({
      dependencyContentList: [],
      targetContent: "hello",
    });
    expect(() =>
      verifyStamp({ dependencyContentList: [], targetContent: output1 })
    ).not.toThrow();
    expect(output1).toMatchInlineSnapshot(`
      "/* @generated CodeStamp<<bca801235b53ad8de2380789961aa484>> */
      hello"
    `);

    const output2 = applyStamp({
      dependencyContentList: [],
      targetContent: output1,
    });
    expect(() =>
      verifyStamp({ dependencyContentList: [], targetContent: output2 })
    ).not.toThrow();
    expect(output2).toStrictEqual(output1);

    const output3 = applyStamp({
      dependencyContentList: ["foo"],
      targetContent: output1,
    });
    expect(() =>
      verifyStamp({ dependencyContentList: ["foo"], targetContent: output3 })
    ).not.toThrow();
    expect(output3).toMatchInlineSnapshot(`
      "/* @generated CodeStamp<<a0e9327ee2cbe366ecb33bf74d2e1644>> */
      hello"
    `);

    const output4 = applyStamp({
      dependencyContentList: [],
      targetContent: output3,
    });
    expect(() =>
      verifyStamp({ dependencyContentList: [], targetContent: output4 })
    ).not.toThrow();
    expect(output4).toStrictEqual(output1);

    const output5 = applyStamp({
      dependencyContentList: [],
      targetContent: "hello",
    });
    expect(() =>
      verifyStamp({ dependencyContentList: [], targetContent: output5 })
    ).not.toThrow();
    expect(output5).toStrictEqual(output1);
  });

  test("`applyStamp` gracefully updates the default stamp placement", () => {
    const output1 = applyStamp({
      dependencyContentList: [],
      targetContent: "hello",
    });
    expect(() =>
      verifyStamp({ dependencyContentList: [], targetContent: output1 })
    ).not.toThrow();
    expect(output1).toMatchInlineSnapshot(`
      "/* @generated CodeStamp<<bca801235b53ad8de2380789961aa484>> */
      hello"
    `);

    // New stamp placement (default -> custom)
    const output2 = applyStamp({
      dependencyContentList: ["ok"],
      targetContent: output1,
      placeInitialStamp: ({ content, stamp }) =>
        `// MY CUSTOM ${stamp}\n${content}`,
    });
    expect(() =>
      verifyStamp({ dependencyContentList: ["ok"], targetContent: output2 })
    ).not.toThrow();
    expect(output2).toMatchInlineSnapshot(`
      "// MY CUSTOM CodeStamp<<04c1e1592377ffac3591df9dd7dc323c>>
      hello"
    `);

    // New stamp placement (default -> custom)
    const output2FromTemplate = applyStamp({
      dependencyContentList: ["ok"],
      targetContent: output1,
      placeInitialStamp: `// MY CUSTOM %STAMP%\n%CONTENT%`,
    });
    expect(() =>
      verifyStamp({
        dependencyContentList: ["ok"],
        targetContent: output2FromTemplate,
      })
    ).not.toThrow();
    expect(output2FromTemplate).toStrictEqual(output2);

    // NOTE: The stamp placement CAN'T BE UPDATED from custom -> custom
    // Because we don't have enough information to revert or restore the content
    const output3 = applyStamp({
      dependencyContentList: ["cool", "cool"],
      targetContent: output2,
      placeInitialStamp: ({ content, stamp }) =>
        `// THIS WON'T BE APPLIED ${stamp}\n${content}`,
    });
    expect(() =>
      verifyStamp({
        dependencyContentList: ["cool", "cool"],
        targetContent: output3,
      })
    ).not.toThrow();
    expect(output3).toMatchInlineSnapshot(`
      "// MY CUSTOM CodeStamp<<f240c52d298ee98a46e4b6ca25c5e15e>>
      hello"
    `);
  });
});
