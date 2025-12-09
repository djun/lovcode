import { forwardRef, type ComponentPropsWithoutRef } from "react";

interface SwitchProps extends Omit<ComponentPropsWithoutRef<"button">, "onChange"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked = false, onCheckedChange, className = "", ...props }, ref) => {
    return (
      <button
        ref={ref}
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange?.(!checked)}
        className={`
          peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center
          rounded-full border-2 border-transparent shadow-sm
          transition-colors focus-visible:outline-none focus-visible:ring-2
          focus-visible:ring-primary focus-visible:ring-offset-2
          disabled:cursor-not-allowed disabled:opacity-50
          ${checked ? "bg-primary" : "bg-border"}
          ${className}
        `}
        {...props}
      >
        <span
          className={`
            pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg
            ring-0 transition-transform
            ${checked ? "translate-x-4" : "translate-x-0"}
          `}
        />
      </button>
    );
  }
);

Switch.displayName = "Switch";
