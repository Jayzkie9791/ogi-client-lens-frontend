import { ReactNode } from "react";

export function SelectableCard({ children, selected }: { readonly children: ReactNode; readonly selected: boolean }) {
  return <label className={["flex min-h-16 cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-colors", selected ? "cl-workflow-choice-selected border-primary-blue text-primary-navy shadow-sm ring-2 ring-blue-100" : "border-[#d4dfec] bg-white text-text-primary hover:border-primary-blue/60 hover:bg-blue-50/50"].join(" ")}>{children}</label>;
}
