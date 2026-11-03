import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const kbdVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-md font-sans leading-none font-medium whitespace-nowrap tabular-nums select-none",
  {
    variants: {
      size: {
        sm: "h-4 text-[10px]",
        md: "h-5 text-[11px]",
        lg: "h-6 text-xs",
      },
      /** Square keys by default; `fit` lets a key like Esc or Enter be as wide as its label. */
      fit: {
        false: "px-1",
        true: "min-w-0 px-1.5",
      },
      /** For dark surfaces such as tooltips. */
      inverted: {
        false: "bg-muted text-muted-foreground shadow-(--shadow-border)",
        true: "bg-background/15 text-background",
      },
      disabled: {
        false: "",
        true: "opacity-50",
      },
    },
    compoundVariants: [
      { fit: false, size: "sm", class: "min-w-4" },
      { fit: false, size: "md", class: "min-w-5" },
      { fit: false, size: "lg", class: "min-w-6" },
    ],
    defaultVariants: {
      size: "md",
      fit: false,
      inverted: false,
      disabled: false,
    },
  },
);

type KbdProps = React.ComponentProps<"kbd"> & VariantProps<typeof kbdVariants>;

/** One key of a keyboard shortcut. */
function Kbd({ className, size, fit, inverted, disabled, ...props }: KbdProps) {
  return (
    <kbd
      data-slot="kbd"
      aria-disabled={disabled || undefined}
      className={cn(kbdVariants({ size, fit, inverted, disabled }), className)}
      {...props}
    />
  );
}

/** A whole shortcut, one `Kbd` per key: `<KbdGroup keys={["⌘", "⌥", "S"]} />`. Spoken as one phrase for screen readers. */
function KbdGroup({
  keys,
  className,
  ...props
}: { keys: string[] } & Omit<KbdProps, "children">) {
  return (
    <span
      data-slot="kbd-group"
      role="group"
      aria-label={keys.join(" ")}
      className={cn("inline-flex items-center gap-0.5", className)}
    >
      {keys.map((key, i) => (
        <Kbd key={i} aria-hidden fit={key.length > 1} {...props}>
          {key}
        </Kbd>
      ))}
    </span>
  );
}

export { Kbd, KbdGroup, kbdVariants };
