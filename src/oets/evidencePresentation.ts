export function humanizeEvidenceTemplateCode(value: string) {
  return normalizeEvidenceAcronyms(value
    .replace(/^OGI_/, "")
    .split("_")
    .map((part) => (/^F\d+$/.test(part) ? part : `${part.charAt(0)}${part.slice(1).toLowerCase()}`))
    .join(" "));
}

export function formatEvidenceSectionTitle(value: string) {
  return normalizeEvidenceAcronyms(value)
    .replace(/\bOcs™/g, "OCS™")
    .replace(/\bOks™/g, "OKS™");
}

function normalizeEvidenceAcronyms(value: string) {
  return value
    .replace(/\bArmaa\b/gi, "ARMAA")
    .replace(/\bOdis\b/gi, "ODIS")
    .replace(/\bAri\b/gi, "ARI")
    .replace(/\bOgi\b/gi, "OGI");
}

export function evidenceSectionGuidance(sectionCode: string) {
  const f003Domains = new Set(["OPERATIONAL_GOVERNANCE", "LIFEGUARD_OPERATIONS", "EMERGENCY_PREPAREDNESS", "FACILITY_OPERATIONS", "EQUIPMENT_READINESS", "TRAINING_COMPLIANCE", "DOCUMENTATION_COMPLIANCE", "INCIDENT_MANAGEMENT", "CORRECTIVE_ACTION_MANAGEMENT", "ENVIRONMENTAL_RISK_MANAGEMENT"]);
  if (f003Domains.has(sectionCode)) return "Rate each audit criterion Low, Moderate, High, or Not Applicable; criteria have no points or weights. Enter the professional-judgment domain score from 1 through the displayed maximum, or mark the entire domain Not Applicable. An N/A domain is excluded—not scored as zero or failed.";
  if (sectionCode === "ARI_SCORING_SUMMARY") return "Backend-calculated ARMAS result. Applicable domain points are divided by their combined applicable maximum and normalized to 100. Domains marked Not Applicable are excluded. All domains N/A produces no result.";
  if (sectionCode === "BASELINE_ARMAA_ASSESSMENT") return "Grade each administrative domain from 0–100 using verified evidence (0 = not demonstrated; 100 = fully demonstrated). Weights: Governance 20%; Documentation 15%; Compliance 15%; Training 10%; Corrective Action 15%; Risk Management 15%; Accountability 10%. Result bands: 95–100 Elite; 90–94 Advanced; 80–89 Effective; 70–79 Developing; 60–69 Weak; below 60 High Risk. Score and classification are calculated automatically.";
  if (sectionCode === "BASELINE_ODIS_ASSESSMENT") return "Grade each defensibility pillar from 0–100 using verified evidence (0 = not demonstrated; 100 = fully demonstrated). The six pillars are equally weighted at 16⅔% each. The ODIS Score and classification are calculated automatically: 95–100 Elite; 90–94 Highly Defensible; 80–89 Defensible; 70–79 Marginal; 60–69 High Exposure; below 60 Critical Exposure.";
  if (sectionCode === "BASELINE_ARI_ASSESSMENT") return "Enter 0–100 from verified evidence for Operational Risk, Emergency Preparedness, and Training & Competency. Administrative Risk is projected from ARMAA, Defensibility from ODIS, and Insurance Readiness from Section 13. Weights: Operational 30%; Administrative 15%; Emergency 15%; Training 15%; Defensibility 15%; Insurance 10%. Result bands: 95–100 Elite; 90–94 Low Risk; 80–89 Controlled; 70–79 Moderate; 60–69 Elevated; below 60 High Risk. Score and classification are calculated automatically.";
  if (sectionCode === "INSURANCE_READINESS_ASSESSMENT") return "Enter one 0–100 baseline Insurance Readiness Index using verified evidence. Result bands: 95–100 Elite; 90–94 Preferred Risk; 80–89 Acceptable Risk; 70–79 Elevated Risk; 60–69 High Exposure; below 60 Critical Exposure. Classification is calculated automatically, and the index is projected into ARI.";
  if (sectionCode === "KNOWLEDGE_DOMAIN_SCORES") return "Enter the earned points for each knowledge domain using the same point scale as the assessment. These values are not percentages or a fixed 1–10 rating. Their combined total must not exceed Total Available Points.";
  if (sectionCode === "CONTINUING_EDUCATION_INTELLIGENCE_CEI") return "Enter values only when supported by a governed Continuing Education record. When no CEU authority exists, leave this optional section blank.";
  if (sectionCode === "AQUATIC_RISK_INTELLIGENCE_REVIEW_ARI") return "Enter values only when supported by a governed Aquatic Risk assessment. Do not estimate or select Low to represent unavailable authority.";
  if (sectionCode === "CLIENT_LENS_DASHBOARD_DATA") return "CRI and Defensibility scores are repeated from their governed source sections. CEI, Compliance, Overall Credential Health, and Dashboard Status remain blank unless separately supported by governed authority.";
  if (sectionCode === "CERTIFICATION_PROFILE") return "Certification Number is system-derived. Certification Registry Number remains blank when no governed registry authority exists; do not invent a substitute.";
  return null;
}

export function formatEvidenceDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function evidenceLifecycleStyle(value: string) {
  if (value === "DRAFT") {
    return { accent: "border-l-evidence-draft", surface: "bg-evidence-draft-bg", badge: "border-evidence-draft bg-white text-evidence-draft" };
  }
  if (["APPROVED", "GOVERNANCE_APPROVED", "INTAKE_APPROVED"].includes(value)) {
    return { accent: "border-l-evidence-approved", surface: "bg-evidence-approved-bg", badge: "border-evidence-approved bg-white text-evidence-approved" };
  }
  if (["REJECTED", "RETURNED", "VOID", "REVOKED"].includes(value)) {
    return { accent: "border-l-evidence-exception", surface: "bg-evidence-exception-bg", badge: "border-evidence-exception bg-white text-evidence-exception" };
  }
  return { accent: "border-l-evidence-review", surface: "bg-evidence-review-bg", badge: "border-evidence-review bg-white text-evidence-review" };
}
