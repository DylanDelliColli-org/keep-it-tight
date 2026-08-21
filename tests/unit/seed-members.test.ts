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

  it("rejects plaintext passwords supplied through process arguments", () => {
    const arguments_ = [1, 2, 3].flatMap((number) => [
      "--member",
      `CLI Member ${number}`,
      `cli${number}@example.com`,
      `cli-password-${number}`,
    ]);

    expect(() => readSeedMembers(arguments_, {})).toThrow(
      /environment variables/i,
    );
  });

  it("rejects duplicate member emails from environment variables", () => {
    const environment = Object.fromEntries(
      [1, 2, 3].flatMap((number) => [
        [`MEMBER_${number}_NAME`, `Member ${number}`],
        [
          `MEMBER_${number}_EMAIL`,
          number === 2 ? "member1@example.com" : `member${number}@example.com`,
        ],
        [`MEMBER_${number}_PASSWORD`, `long-password-${number}`],
      ]),
    );

    expect(() =>
      readSeedMembers([], environment),
    ).toThrow(/unique/);
  });
});
