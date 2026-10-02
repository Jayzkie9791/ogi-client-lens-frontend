import type { ExecutivePresentationContent } from "./executivePresentationTypes";

export function validateForSave(content: ExecutivePresentationContent): string | null {
  if (content.sections.length > 50) return "A presentation may contain at most 50 sections.";
  for (const [sectionIndex, section] of content.sections.entries()) {
    const label = `Section ${sectionIndex + 1}`;
    if (!bounded(section.heading, 160)) return `${label} heading is required and must not exceed 160 characters.`;
    if (!bounded(section.scope, 500)) return `${label} scope is required and must not exceed 500 characters.`;
    if (section.classification != null && section.classification.length > 100) return `${label} classification must not exceed 100 characters.`;
    if (section.findings.length > 50 || section.recommendations.length > 50) return `${label} may contain at most 50 findings and 50 recommendations/actions.`;
    if (section.findings.some((finding) => !bounded(finding, 2000))) return `${label} contains an empty or overlong finding.`;
    if (section.recommendations.some((item) => !bounded(item.text, 2000))) return `${label} contains an empty or overlong recommendation/action.`;
  }
  if (new TextEncoder().encode(JSON.stringify(content)).length > 1024 * 1024) return "The complete presentation exceeds the 1 MiB limit.";
  return null;
}

function bounded(value: string, maximum: number) {
  return value.trim().length > 0 && value.length <= maximum;
}

