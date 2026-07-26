import {
  ButtonHTMLAttributes,
  cloneElement,
  isValidElement,
  ReactElement,
  ReactNode
} from "react";

type ButtonVariant = "primary" | "secondary";

interface ButtonBaseProps {
  className?: string;
  variant?: ButtonVariant;
}

type AsChildElement = ReactElement<{ className?: string }>;

type AsChildButtonProps = ButtonBaseProps & {
  asChild: true;
  children: AsChildElement;
};

type NativeButtonProps = ButtonBaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: false;
    children: ReactNode;
  };

export function Button(props: AsChildButtonProps | NativeButtonProps) {
  const {
    asChild = false,
    className = "",
    variant = "primary",
    children,
    ...buttonProps
  } = props;
  const classes = buttonClasses(variant, className);

  if (asChild && isValidElement<{ className?: string }>(children)) {
    return cloneElement(children, {
      className: [children.props.className, classes].filter(Boolean).join(" ")
    });
  }

  return (
    <button className={classes} type="button" {...buttonProps}>
      {children}
    </button>
  );
}

function buttonClasses(variant: ButtonVariant, className: string) {
  const base =
    "inline-flex items-center justify-center rounded-component px-3 py-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";
  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-primary-blue text-text-inverse hover:bg-primary-navy active:bg-primary-navy",
    secondary:
      "border border-border bg-surface text-text-primary hover:bg-elevated"
  };

  return [base, variants[variant], className].filter(Boolean).join(" ");
}
