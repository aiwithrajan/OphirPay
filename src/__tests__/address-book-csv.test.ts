// SPDX-License-Identifier: MIT

import { describe, it, expect, beforeEach } from "vitest";
import {
  formatAddressBookCsv,
  parseAddressBookCsv,
  importAddressBookCsv,
  getAddressBook,
  type AddressEntry,
} from "@/lib/address-book";

const VALID_ADDR_1 = "GA2H7TG4ND7G456PWHB7YDY53O7QHQZ474M6Z6Q6R6S6T6U6V6W6X6Y6";
const VALID_ADDR_2 = "GB3H7TG4ND7G456PWHB7YDY53O7QHQZ474M6Z6Q6R6S6T6U6V6W6X6Y7";
const VALID_ADDR_3 = "GC4H7TG4ND7G456PWHB7YDY53O7QHQZ474M6Z6Q6R6S6T6U6V6W6X6Y8";

describe("Address Book CSV Import and Export (Issue #811)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("formatAddressBookCsv & parseAddressBookCsv (Round-trip)", () => {
    it("exports entries and parses them back into an identical array", () => {
      const sampleEntries: AddressEntry[] = [
        { label: "Treasury", publicKey: VALID_ADDR_1, memo: "ops-fund" },
        { label: "Payroll, Primary", publicKey: VALID_ADDR_2, memo: "sept-2026" },
        { label: "Emergency Reserve", publicKey: VALID_ADDR_3 },
      ];

      const csv = formatAddressBookCsv(sampleEntries);
      expect(csv).toContain("label,address,memo");
      expect(csv).toContain('"Payroll, Primary"');

      const result = parseAddressBookCsv(csv);
      expect(result.errors).toHaveLength(0);
      expect(result.entries).toHaveLength(3);
      expect(result.entries[0]).toEqual(sampleEntries[0]);
      expect(result.entries[1]).toEqual(sampleEntries[1]);
      expect(result.entries[2]).toEqual(sampleEntries[2]);
    });
  });

  describe("empty or header-only CSV", () => {
    it("handles empty text gracefully with a clear message", () => {
      const result = parseAddressBookCsv("");
      expect(result.entries).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(result.message).toBe("The CSV file is empty.");
    });

    it("handles whitespace-only text gracefully", () => {
      const result = parseAddressBookCsv("   \n\n  ");
      expect(result.entries).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(result.message).toBe("The CSV file is empty.");
    });

    it("handles header-only CSV with an informative notice", () => {
      const result = parseAddressBookCsv("label,address,memo\n");
      expect(result.entries).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(result.message).toBe("The CSV file contains only headers with no address rows.");
    });
  });

  describe("partial failure and validation reporting", () => {
    it("imports valid rows while reporting row numbers and reasons for invalid rows", () => {
      const csvData = [
        "label,address,memo",
        `Alice,${VALID_ADDR_1},coffee`,
        "Bob,INVALID_STELLAR_KEY,lunch",
        `,${VALID_ADDR_2},no-label`,
        `Charlie,${VALID_ADDR_3},memo-exceeding-twenty-eight-bytes-long`,
        `Dana,${VALID_ADDR_2},valid-again`,
      ].join("\n");

      const result = parseAddressBookCsv(csvData);

      // Rows 2 and 6 (data row 1 and 5) are valid
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].label).toBe("Alice");
      expect(result.entries[1].label).toBe("Dana");

      // Rows 3, 4, 5 are reported as errors with row numbers (1-indexed matching the file)
      expect(result.errors).toHaveLength(3);
      expect(result.errors[0].row).toBe(3);
      expect(result.errors[0].reason).toContain("Invalid Stellar address");
      expect(result.errors[1].row).toBe(4);
      expect(result.errors[1].reason).toContain("Label is required");
      expect(result.errors[2].row).toBe(5);
      expect(result.errors[2].reason).toContain("Memo must be 28 characters or fewer");
    });

    it("persists valid entries to localStorage even when some rows fail", () => {
      const csvData = [
        "label,address,memo",
        `Valid One,${VALID_ADDR_1},memo1`,
        "Invalid Row,NOT_A_KEY,memo2",
      ].join("\n");

      const importResult = importAddressBookCsv(csvData);
      expect(importResult.savedCount).toBe(1);
      expect(importResult.errors).toHaveLength(1);

      const saved = getAddressBook();
      expect(saved).toHaveLength(1);
      expect(saved[0].publicKey).toBe(VALID_ADDR_1);
      expect(saved[0].label).toBe("Valid One");
    });
  });

  describe("header flexibility", () => {
    it("recognizes alternative header names like Name, PublicKey, Note", () => {
      const csvData = [
        "Name,PublicKey,Note",
        `Grants DAO,${VALID_ADDR_1},q3-grant`,
      ].join("\n");

      const result = parseAddressBookCsv(csvData);
      expect(result.errors).toHaveLength(0);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toEqual({
        label: "Grants DAO",
        publicKey: VALID_ADDR_1,
        memo: "q3-grant",
      });
    });
  });
});
