import { apiRequest } from "../api/client";
import { isOetsTemplateRuntimeDefinition } from "./definitionGuards";
import { OetsTemplateRuntimeDefinition } from "./types";

export function getCurrentRuntimeTemplate(templateCode: string) {
  return apiRequest<OetsTemplateRuntimeDefinition>(
    `/api/v1/operational-evidence/templates/${encodeURIComponent(
      templateCode
    )}/current`,
    {
      validate: isOetsTemplateRuntimeDefinition
    }
  );
}
