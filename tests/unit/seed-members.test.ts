import { describe, expect, it } from "vitest";

import { readSeedMembers } from "../../scripts/seed-members";

describe("seed member input", () => {
  it("reads exactly three accounts from environment variables", () => {
    const environment = Object.fromEntries(
      [1, 2, 3].flatMap((number) => [
        [`MEMBER_${number}_NAME`, `Member ${number}`],
        [`MEMBER_${number}_EMAIL`, `member${number}@example.com`],
        [`MEMBER_${number}_PASSWORD`, `long-password-${number}`],
      ]),
    );

    expect(readSeedMembers([], environment)).toEqual([
      {
        email: "member1@example.com",
        name: "Member 1",
        password: "long-password-1",
      },
      {
        email: "member2@example.com",
        name: "Member 2",
        password: "long-password-2",
      },
      {
        email: "member3@example.com",
        name: "Member 3",
        password: "long-password-3",
      },
    ]);
  });

  it("accepts three CLI member groups and rejects duplicate emails", () => {
    const arguments_ = [1, 2, 3].flatMap((number) => [
      "--member",
      `CLI Member ${number}`,
      `cli${number}@example.com`,
      `cli-password-${number}`,
    ]);

    expect(readSeedMembers(arguments_, {})).toHaveLength(3);
    expect(() =>
      readSeedMembers(
        arguments_.map((value) =>
          value === "cli2@example.com" ? "cli1@example.com" : value,
        ),
        {},
      ),
    ).toThrow(/unique/);
  });
});
