export interface OetsDiagnosticsEnvironment {
  development: boolean;
  flag: string | undefined;
}

export function isOetsDeveloperDiagnosticsEnabled(
  environment: OetsDiagnosticsEnvironment = {
    development: import.meta.env.DEV,
    flag: import.meta.env.VITE_OETS_DEVELOPER_DIAGNOSTICS
  }
) {
  return environment.development && environment.flag === "enabled";
}
