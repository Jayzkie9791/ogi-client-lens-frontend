const governedAcronyms = new Map<string, string>([
  ["aed", "AED"],
  ["api", "API"],
  ["ari", "ARI"],
  ["armaa", "ARMAA"],
  ["armas", "ARMAS"],
  ["cap", "CAP"],
  ["cei", "CEI"],
  ["cpr", "CPR"],
  ["cri", "CRI"],
  ["eap", "EAP"],
  ["id", "ID"],
  ["ifr", "IFR"],
  ["iir", "IIR"],
  ["isi", "ISI"],
  ["isr", "ISR"],
  ["kpi", "KPI"],
  ["lei", "LEI"],
  ["lms", "LMS"],
  ["lti", "LTI"],
  ["odis", "ODIS"],
  ["oets", "OETS"],
  ["ogi", "OGI"],
  ["ori", "ORI"],
  ["pdf", "PDF"],
  ["rbac", "RBAC"],
  ["rei", "REI"],
  ["rer", "RER"],
  ["rpn", "RPN"],
  ["rrs", "RRS"],
  ["rrv", "RRV"],
  ["sir", "SIR"],
  ["sms", "SMS"],
  ["uat", "UAT"],
  ["url", "URL"],
  ["uuid", "UUID"]
]);

const governedTrademarkAcronyms = new Set([
  "acr", "ari", "biis", "cacr", "cdr", "cri", "dei", "dfr", "drs", "ds",
  "err", "frr", "hsi", "icr", "ids", "ifr", "iir", "isi", "isr", "lei",
  "nmsi", "ocs", "oks", "pos", "rdr", "rei", "rer", "rpn", "rrs", "rrv",
  "sir", "vs"
]);

for(const acronym of governedTrademarkAcronyms)governedAcronyms.set(acronym,acronym.toUpperCase());

/** Normalizes governed acronyms in system-authored presentation text only. */
export function normalizeDisplayAcronyms(value: string) {
  return value.replace(/\b[A-Za-z]+\b/g, (word, offset:number, source:string) => {
    const key=word.toLowerCase();
    if(source[offset+word.length]==="™"&&governedTrademarkAcronyms.has(key))return word.toUpperCase();
    if (word === word.toLowerCase()) return word;
    return governedAcronyms.get(key) ?? word;
  });
}

/** Converts a machine code to a readable label without damaging acronyms. */
export function humanizeDisplayCode(value: string) {
  const label = value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
  return normalizeDisplayAcronyms(label);
}

/** Converts a machine code to sentence case while preserving governed acronyms. */
export function humanizeDisplaySentence(value:string){
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part,index)=>governedAcronyms.get(part.toLowerCase())??(index===0?part.charAt(0).toUpperCase()+part.slice(1).toLowerCase():part.toLowerCase()))
    .join(" ");
}
