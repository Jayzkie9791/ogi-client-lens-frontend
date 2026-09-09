import { FormEventHandler, KeyboardEventHandler, ReactNode, RefObject } from "react";

export interface WorkflowStep {
  readonly key: string;
  readonly label: string;
}

export function WorkflowModal({ children, currentStep, dialogRef, eyebrow, footer, onKeyDown, onSubmit, steps, title, titleId }: {
  readonly children: ReactNode;
  readonly currentStep: number;
  readonly dialogRef: RefObject<HTMLDivElement | null>;
  readonly eyebrow: string;
  readonly footer: ReactNode;
  readonly onKeyDown: KeyboardEventHandler<HTMLDivElement>;
  readonly onSubmit: FormEventHandler<HTMLFormElement>;
  readonly steps: readonly WorkflowStep[];
  readonly title: string;
  readonly titleId: string;
}) {
  return <div className="cl-workflow-overlay fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 backdrop-blur-[2px] sm:items-center sm:p-6" role="presentation">
    <div aria-labelledby={titleId} aria-modal="true" className="cl-workflow-dialog h-[calc(100vh-1.5rem)] w-full overflow-hidden rounded-xl border border-primary-blue/20 bg-white shadow-2xl" onKeyDown={onKeyDown} ref={dialogRef} role="dialog" tabIndex={-1}>
      <form className="flex h-full min-h-0 flex-col" onSubmit={onSubmit}>
        <header className="cl-workflow-header relative shrink-0 overflow-hidden border-b px-5 py-5 sm:px-7">
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-accent-red" />
          <div className="flex items-center justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-blue">{eyebrow}</p><h2 className="mt-1 text-2xl font-semibold text-primary-navy" id={titleId}>{title}</h2></div><img alt="" aria-hidden="true" className="hidden h-11 w-auto object-contain sm:block" src="/brand/client-lens-logo.png" /></div>
          <WorkflowProgress currentStep={currentStep} steps={steps} />
        </header>
        <div className="cl-workflow-canvas min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">{children}</div>
        <footer className="cl-workflow-footer flex shrink-0 flex-wrap justify-between gap-3 border-t px-5 py-4 sm:px-7">{footer}</footer>
      </form>
    </div>
  </div>;
}

export function WorkflowProgress({ currentStep, steps }: { readonly currentStep: number; readonly steps: readonly WorkflowStep[] }) {
  return <ol aria-label="Registration progress" className="mt-5 grid grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-6">{steps.map((step, position) => {
    const complete = position < currentStep;
    const current = position === currentStep;
    return <li aria-current={current ? "step" : undefined} className="relative flex min-w-0 flex-col items-center gap-1 text-center" key={step.key}>
      {position > 0 ? <span aria-hidden="true" className={["absolute right-1/2 top-3.5 hidden h-0.5 w-full sm:block", position <= currentStep ? "bg-primary-navy" : "cl-workflow-progress-track"].join(" ")} /> : null}
      <span aria-hidden="true" className={["relative z-10 flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold", current ? "border-primary-blue bg-primary-blue text-white shadow-sm ring-4 ring-blue-100" : complete ? "border-primary-navy bg-primary-navy text-white" : "border-[#afc5df] bg-white text-text-muted"].join(" ")}>{complete ? "✓" : position + 1}</span>
      <span className={current ? "text-xs font-bold text-primary-blue" : complete ? "text-xs font-semibold text-primary-navy" : "text-xs text-text-muted"}>{step.label}</span>
    </li>;
  })}</ol>;
}

export function WorkflowContentCard({ children, currentLabel, stepNumber, totalSteps }: { readonly children: ReactNode; readonly currentLabel: string; readonly stepNumber: number; readonly totalSteps: number }) {
  return <div className="cl-workflow-card mx-auto min-h-full max-w-3xl overflow-hidden rounded-xl border border-t-4 border-t-primary-blue bg-white p-5 sm:p-6">
    <div className="cl-workflow-divider mb-5 border-b pb-3"><p className="text-xs font-bold uppercase tracking-wide text-primary-blue">Step {stepNumber} of {totalSteps}</p><p className="mt-1 text-lg font-semibold text-primary-navy">{currentLabel}</p><span className="sr-only">Current step: {currentLabel}</span></div>
    {children}
  </div>;
}
