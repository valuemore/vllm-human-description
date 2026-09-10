import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvObjects } from "@/lib/export/csv-parse";
import { toCsv } from "@/lib/export/csv";

describe("parseCsv", () => {
  it("따옴표·개행·이스케이프", () => {
    const text = 'a,b\r\n1,"x, y"\r\n2,"multi\nline"\r\n3,"say ""hi"""\r\n';
    expect(parseCsv(text)).toEqual([["a", "b"], ["1", "x, y"], ["2", "multi\nline"], ["3", 'say "hi"']]);
  });
  it("BOM 제거·빈 행 무시", () => {
    expect(parseCsvObjects("﻿video_code,generated_text\n\nV01,아동이 논다\n")).toEqual([{ video_code: "V01", generated_text: "아동이 논다" }]);
  });
  it("toCsv 왕복", () => {
    const rows = [{ a: "1", b: 'q"uote' }, { a: "2", b: "줄\n바꿈" }];
    const csv = toCsv(rows, [{ key: "a", header: "a" }, { key: "b", header: "b" }]);
    expect(parseCsvObjects(csv)).toEqual(rows);
  });
});
