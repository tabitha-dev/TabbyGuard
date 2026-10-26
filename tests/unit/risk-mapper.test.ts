import { describe, expect, it } from "vitest";
import { createDeterministicPlan } from "../../src/risk/mapper.js";

const file = (filename: string, patch = "") => ({
  filename,
  status: "modified",
  additions: 3,
  deletions: 1,
  changes: 4,
  patch,
});

describe("risk mapper", () => {
  it("targets navigation changes instead of unrelated checks", () => {
    const plan = createDeterministicPlan(
      [file("src/components/Header.tsx", "+ <button aria-expanded>")],
      ["/"],
      16,
    );
    expect(plan.some((item) => item.targetSurface === "Navigation")).toBe(true);
    expect(plan.some((item) => item.checkType === "interaction")).toBe(true);
    expect(
      plan.every((item) =>
        item.changedFiles.includes("src/components/Header.tsx"),
      ),
    ).toBe(true);
  });

  it("uses a safe fallback when no rule matches", () => {
    const plan = createDeterministicPlan(
      [file("src/components/Widget.tsx")],
      ["/"],
      16,
    );
    expect(plan.map((item) => item.checkType)).toEqual([
      "layout",
      "runtime",
      "accessibility",
    ]);
  });
  it("does not confuse filename fragments with actual risk names", () => {
    for (const filename of [
      "src/ui/Cardigan.tsx",
      "src/components/Statement.ts",
      "src/ui/Menuet.tsx",
      "src/ui/Naval.tsx",
    ]) {
      const plan = createDeterministicPlan([file(filename)], ["/"], 16);
      expect(
        plan.every((item) => item.targetSurface === "Changed frontend surface"),
      ).toBe(true);
    }
  });

  it("still recognizes CamelCase components", () => {
    const plan = createDeterministicPlan(
      [file("src/ui/NavMenu.tsx"), file("src/ui/CheckoutForm.tsx")],
      ["/", "/checkout"],
      16,
    );
    expect(plan.some((item) => item.targetSurface === "Navigation")).toBe(true);
    expect(plan.some((item) => item.targetSurface === "Form flow")).toBe(true);
  });

  it("ignores context and removed-only diff markers", () => {
    const patch =
      "@@ -1,2 +1,2 @@\n const label = 'menu';\n-<button aria-expanded>\n+<h1>Hi</h1>";
    const plan = createDeterministicPlan(
      [file("src/ui/Widget.tsx", patch)],
      ["/"],
      16,
    );
    expect(
      plan.every((item) => item.targetSurface === "Changed frontend surface"),
    ).toBe(true);
  });

  it("samples every requested route before checking one route repeatedly", () => {
    const routes = ["/", "/settings", "/pricing"];
    const plan = createDeterministicPlan(
      [file("src/ui/Header.tsx")],
      routes,
      3,
    );
    expect(new Set(plan.map((item) => item.route)).size).toBe(3);
  });

  it("prevents earlier rules from starving independent risk categories", () => {
    const plan = createDeterministicPlan(
      [
        file("src/ui/Header.tsx"),
        file("src/ui/CheckoutForm.tsx"),
        file("src/data/Query.ts"),
      ],
      ["/", "/checkout"],
      5,
    );
    expect(new Set(plan.map((item) => item.targetSurface))).toEqual(
      new Set(["Navigation", "Form flow", "Data and loading state"]),
    );
    expect(plan).toHaveLength(5);
  });

  it("prioritizes matching routes when the budget is one check", () => {
    const plan = createDeterministicPlan(
      [file("src/ui/CheckoutForm.tsx")],
      ["/", "/checkout"],
      1,
    );
    expect(plan[0].route).toBe("/checkout");
  });

  it("applies the same route fairness to fallback PR checks", () => {
    const plan = createDeterministicPlan(
      [file("src/ui/Widget.tsx")],
      ["/", "/about", "/team"],
      3,
    );
    expect(new Set(plan.map((item) => item.route)).size).toBe(3);
  });
});
