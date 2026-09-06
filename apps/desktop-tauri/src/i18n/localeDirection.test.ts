import { describe, expect, it } from "vitest";
import { localeDocumentMetadata } from "./localeDirection";

describe("locale document metadata", () => {
  it("uses Arabic RTL metadata only for Arabic", () => {
    expect(localeDocumentMetadata("arabic")).toEqual({ lang: "ar", dir: "rtl" });
    expect(localeDocumentMetadata("english")).toEqual({ lang: "en", dir: "ltr" });
    expect(localeDocumentMetadata("chinesetraditional")).toEqual({ lang: "zh-Hant", dir: "ltr" });
  });
});
