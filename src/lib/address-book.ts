// SPDX-License-Identifier: MIT

/**
 * Client-side address book using localStorage.
 * Stores frequently used Stellar addresses with labels for quick access.
 */

import { isValidStellarAddress } from "@/lib/stellar";
import { parseCsvText } from "@/lib/csv-import";

export interface AddressEntry {
  publicKey: string;
  label: string;
  memo?: string;
  lastUsed?: number;
}

export interface AddressBookImportError {
  row: number;
  reason: string;
}

export interface AddressBookParseResult {
  entries: AddressEntry[];
  errors: AddressBookImportError[];
  message?: string;
}

const STORAGE_KEY = "ophirpay-address-book";

/** Get all saved addresses from localStorage. */
export function getAddressBook(): AddressEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AddressEntry[]) : [];
  } catch {
    return [];
  }
}

/** Add or update an address in the address book. */
export function saveAddress(entry: AddressEntry): void {
  const book = getAddressBook();
  const idx = book.findIndex((a) => a.publicKey === entry.publicKey);
  if (idx >= 0) {
    book[idx] = { ...book[idx], ...entry, lastUsed: Date.now() };
  } else {
    book.push({ ...entry, lastUsed: Date.now() });
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(book));
}

/** Remove an address from the address book. */
export function removeAddress(publicKey: string): void {
  const book = getAddressBook().filter((a) => a.publicKey !== publicKey);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(book));
}

/** Search address book by label or public key. */
export function searchAddressBook(query: string): AddressEntry[] {
  const q = query.toLowerCase();
  return getAddressBook().filter(
    (a) =>
      a.label.toLowerCase().includes(q) ||
      a.publicKey.toLowerCase().includes(q)
  );
}

/** Get recently used addresses (last 5 by lastUsed). */
export function getRecentAddresses(limit = 5): AddressEntry[] {
  return getAddressBook()
    .filter((a) => a.lastUsed)
    .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))
    .slice(0, limit);
}

/**
 * Return the subset of `entries` whose public key is not already present in
 * `existingAddresses`. Used to merge address-book selections into a batch
 * recipient list without duplicating manually added or CSV-imported rows.
 * Existing addresses are trimmed before comparison so whitespace differences
 * don't produce false duplicates.
 */
export function mergeAddressBookSelections(
  entries: AddressEntry[],
  existingAddresses: string[]
): AddressEntry[] {
  const existing = new Set(existingAddresses.map((a) => a.trim()));
  return entries.filter((e) => !existing.has(e.publicKey));
}

/**
 * Format address book entries into RFC-4180 CSV text.
 */
export function formatAddressBookCsv(entries: AddressEntry[]): string {
  const header = "label,address,memo";
  const escape = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n") || val.includes("\r")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };
  const rows = entries.map((e) =>
    [escape(e.label), escape(e.publicKey), escape(e.memo ?? "")].join(",")
  );
  return [header, ...rows].join("\n");
}

/**
 * Parse address book CSV text into AddressEntry array and validation errors.
 * Uses RFC-4180 parsing, supports headers (label, address, memo), and validates Stellar addresses.
 */
export function parseAddressBookCsv(text: string): AddressBookParseResult {
  if (!text || !text.trim()) {
    return {
      entries: [],
      errors: [],
      message: "The CSV file is empty.",
    };
  }

  const rawRows = parseCsvText(text);
  if (rawRows.length === 0) {
    return {
      entries: [],
      errors: [],
      message: "The CSV file is empty.",
    };
  }

  const firstRow = rawRows[0].map((c) => c.trim().toLowerCase());
  let labelIdx = -1;
  let addressIdx = -1;
  let memoIdx = -1;

  const isHeader = firstRow.some((c) =>
    ["label", "name", "nickname", "address", "publickey", "public_key", "memo", "note"].includes(c)
  );

  let dataRows: string[][];
  let startRowNumber = 1;

  if (isHeader) {
    firstRow.forEach((col, idx) => {
      if (["label", "name", "nickname"].includes(col)) labelIdx = idx;
      else if (["address", "publickey", "public_key", "recipient"].includes(col)) addressIdx = idx;
      else if (["memo", "note"].includes(col)) memoIdx = idx;
    });

    dataRows = rawRows.slice(1);
    startRowNumber = 2;
  } else {
    labelIdx = 0;
    addressIdx = 1;
    memoIdx = 2;
    dataRows = rawRows;
    startRowNumber = 1;
  }

  if (dataRows.length === 0) {
    return {
      entries: [],
      errors: [],
      message: "The CSV file contains only headers with no address rows.",
    };
  }

  if (labelIdx === -1 && addressIdx !== 0) labelIdx = 0;
  if (addressIdx === -1 && labelIdx !== 1) addressIdx = 1;
  if (memoIdx === -1) memoIdx = 2;

  const entries: AddressEntry[] = [];
  const errors: AddressBookImportError[] = [];

  dataRows.forEach((row, idx) => {
    const rowNumber = startRowNumber + idx;
    const label = (row[labelIdx] ?? "").trim();
    const address = (row[addressIdx] ?? "").trim();
    const rawMemo = memoIdx >= 0 && row[memoIdx] !== undefined ? row[memoIdx].trim() : undefined;
    const memo = rawMemo && rawMemo.length > 0 ? rawMemo : undefined;

    const rowErrors: string[] = [];

    if (!label) {
      rowErrors.push("Label is required.");
    } else if (label.length > 100) {
      rowErrors.push("Label must be 100 characters or fewer.");
    }

    if (!address) {
      rowErrors.push("Address is required.");
    } else if (!isValidStellarAddress(address)) {
      rowErrors.push("Invalid Stellar address — must be 56 characters starting with G.");
    }

    if (memo && memo.length > 28) {
      rowErrors.push("Memo must be 28 characters or fewer.");
    }

    if (rowErrors.length > 0) {
      errors.push({
        row: rowNumber,
        reason: rowErrors.join(" "),
      });
    } else {
      entries.push({
        label,
        publicKey: address,
        memo,
      });
    }
  });

  return {
    entries,
    errors,
  };
}

/**
 * Import address book CSV text into localStorage, saving all valid entries
 * and returning the import result summary with any row errors.
 */
export function importAddressBookCsv(
  text: string
): AddressBookParseResult & { savedCount: number } {
  const result = parseAddressBookCsv(text);
  for (const entry of result.entries) {
    saveAddress(entry);
  }
  return {
    ...result,
    savedCount: result.entries.length,
  };
}

/**
 * Trigger download of address book as CSV file in browser environment.
 */
export function exportAddressBookToCsv(
  entries?: AddressEntry[],
  filename = "address-book.csv"
): void {
  const list = entries ?? getAddressBook();
  const csvContent = formatAddressBookCsv(list);
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

