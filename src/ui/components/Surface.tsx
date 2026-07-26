import { HTMLAttributes } from "react";

type SurfaceProps = HTMLAttributes<HTMLDivElement>;

export function Surface({ className = "", ...props }: SurfaceProps) {
  return (
    <div
      className={[
        "rounded-panel border border-border bg-surface p-5 shadow-panel",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
