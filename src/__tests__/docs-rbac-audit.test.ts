// SPDX-License-Identifier: MIT

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const rbacAuditPath = path.join(root, "docs", "RBAC-AUDIT.md");
const csrfAuditPath = path.join(root, "docs", "CSRF-AUDIT.md");

describe("Audit document issue citations (issue #689)", () => {
  it("exists at docs/RBAC-AUDIT.md", () => {
    expect(existsSync(rbacAuditPath)).toBe(true);
  });

  it("cites issue #392 matching its target link in RBAC-AUDIT.md", () => {
    const content = readFileSync(rbacAuditPath, "utf-8");
    expect(content).toContain("[Issue #392](https://github.com/OphirPay/OphirPay/issues/392)");
    expect(content).not.toContain("[Issue #388](https://github.com/OphirPay/OphirPay/issues/392)");
  });

  it("cites issue #563 matching its target link in CSRF-AUDIT.md", () => {
    const content = readFileSync(csrfAuditPath, "utf-8");
    expect(content).toContain("[Issue #563](https://github.com/OphirPay/OphirPay/issues/563)");
  });
});
