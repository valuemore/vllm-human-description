import { describe, expect, it } from "vitest";
import { escapeCsv, formatCell, toCsv } from "@/lib/export/csv";

describe("csv", () => {
  it("RFC4180 escaping", () => {
    expect(escapeCsv("plain")).toBe("plain");
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsv("a,b")).toBe('"a,b"');
    expect(escapeCsv("line1\nline2")).toBe('"line1\nline2"');
  });
  it("셀 포맷: null→빈칸, boolean→TRUE/FALSE, 객체→JSON", () => {
    expect(formatCell(null)).toBe("");
    expect(formatCell(true)).toBe("TRUE");
    expect(formatCell(3.5)).toBe("3.5");
    expect(formatCell({ a: 1 })).toBe('{"a":1}');
  });
  it("BOM + CRLF + 헤더", () => {
    const csv = toCsv([{ participant_code: "T01", text: "아동 A가, 집는다" }], [{ key: "participant_code", header: "participant_code" }, { key: "text", header: "observation_text" }]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe('﻿participant_code,observation_text\r\nT01,"아동 A가, 집는다"\r\n');
  });
});
