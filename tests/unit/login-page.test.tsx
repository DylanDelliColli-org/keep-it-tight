import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/app/login/page";

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: (initial: unknown) => [initial, vi.fn()],
}));

type LoginForm = ReactElement<{
  onSubmit: (event: {
    currentTarget: HTMLFormElement;
    preventDefault: () => void;
  }) => Promise<void>;
}>;

describe("login page redirect", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects a backslash target that resolves to another origin", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", {
      location: {
        assign,
        href: "https://contest.example/login?next=%2F%5Cevil.example",
        search: "?next=%2F%5Cevil.example",
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    );
    vi.stubGlobal(
      "FormData",
      class {
        get(name: string): string {
          return name === "email"
            ? "member@example.com"
            : "fixture-password";
        }
      },
    );

    const page = LoginPage() as ReactElement<{ children: LoginForm }>;
    await page.props.children.props.onSubmit({
      currentTarget: {} as HTMLFormElement,
      preventDefault: vi.fn(),
    });

    expect(assign).toHaveBeenCalledWith("/");
  });
});
