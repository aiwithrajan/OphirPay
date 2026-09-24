// SPDX-License-Identifier: MIT

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const specPath = path.join(root, "docs", "SPEC.md");
const roadmapPath = path.join(root, "ROADMAP.md");
const readmePath = path.join(root, "README.md");
const verificationPath = path.join(root, "docs", "VERIFICATION.md");

describe("Verification status reconciliation across docs (issue #696)", () => {
  it("exists at docs/VERIFICATION.md as canonical specification", () => {
    expect(existsSync(verificationPath)).toBe(true);
    const content = readFileSync(verificationPath, "utf-8");
    expect(content).toContain("Honest status");
    expect(content).toContain("hand-written models");
  });

  it("references docs/VERIFICATION.md in docs/SPEC.md", () => {
    const content = readFileSync(specPath, "utf-8");
    expect(content).toContain("see [docs/VERIFICATION.md](VERIFICATION.md)");
    expect(content).toContain("Bounded model checking with `kani` for 10 modeled invariants");
  });

  it("references docs/VERIFICATION.md in ROADMAP.md", () => {
    const content = readFileSync(roadmapPath, "utf-8");
    expect(content).toContain("[docs/VERIFICATION.md](docs/VERIFICATION.md)");
  });

  it("references docs/VERIFICATION.md in README.md", () => {
    const content = readFileSync(readmePath, "utf-8");
    expect(content).toContain("[docs/VERIFICATION.md](docs/VERIFICATION.md)");
  });
});
