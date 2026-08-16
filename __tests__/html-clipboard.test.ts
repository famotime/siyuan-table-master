// @vitest-environment happy-dom

import { describe, it, expect } from "vitest";
import {
  stripOfficeMsoTags,
  normalizeHtmlTable,
} from "../src/html-clipboard";

describe("html-clipboard", () => {
  describe("stripOfficeMsoTags", () => {
    it("should remove MSO comments and conditional blocks", () => {
      const input = `<!--[if gte mso 9]><xml><w:WordDocument></w:WordDocument></xml><![endif]--><p>Clean Text</p>`;
      const output = stripOfficeMsoTags(input);
      expect(output).toBe("<p>Clean Text</p>");
    });

    it("should strip mso- CSS properties from inline style attributes", () => {
      const input = `<td style="mso-height-source:userset;height:20pt;color:#1F2937;mso-width-alt:2880">Content</td>`;
      const output = stripOfficeMsoTags(input);
      expect(output).toContain("color:#1F2937");
      expect(output).toContain("height:20pt");
      expect(output).not.toContain("mso-height-source");
      expect(output).not.toContain("mso-width-alt");
    });
  });

  describe("normalizeHtmlTable", () => {
    it("should wrap bare tr elements in table and tbody", () => {
      const input = `<tr><td>A</td><td>B</td></tr>`;
      const output = normalizeHtmlTable(input);
      expect(output).toContain("<table");
      expect(output).toContain("<tbody");
      expect(output).toContain("<td>A</td>");
    });

    it("should elevate first row of all th elements into thead", () => {
      const input = `<table><tr><th>Title</th><th>Score</th></tr><tr><td>Alice</td><td>100</td></tr></table>`;
      const output = normalizeHtmlTable(input);
      expect(output).toContain("<thead");
      expect(output).toContain("<th>Title</th>");
      expect(output).toContain("<tbody");
      expect(output).toContain("<td>Alice</td>");
    });
  });
});
