import { generateText, type JSONContent } from "@tiptap/react";
import { baseExtensions } from "@/components/rich-text/extensions";

export function parseDescriptionText(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const json: JSONContent = JSON.parse(raw);
    return generateText(json, baseExtensions);
  } catch {
    return raw;
  }
}
