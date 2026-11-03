import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden border border-transparent font-medium whitespace-nowrap tabular-nums transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-muted text-foreground",
        transparent: "bg-transparent text-muted-foreground",
        inverted: "bg-foreground text-background",
        outline: "border-border bg-transparent text-foreground",
        danger: "bg-destructive/10 text-destructive dark:bg-destructive/20",
        brand: "bg-primary/10 text-primary",
      },
      size: {
        sm: "h-4 min-w-4 px-1.5 text-[10px] [&>svg]:size-2.5",
        md: "h-5 min-w-5 px-2 text-xs [&>svg]:size-3",
        lg: "h-6 min-w-6 px-2.5 text-sm [&>svg]:size-3.5",
      },
      /** Pills are fully rounded. Squares are for counts and single characters. */
      shape: {
        pill: "rounded-full",
        square: "rounded-md",
      },
    },
    defaultVariants: { variant: "default", size: "md", shape: "pill" },
  },
);

/** A label or count: `<Badge variant="brand">New</Badge>`, `<Badge shape="square" size="sm">3</Badge>`. */
function Badge({
  className,
  variant = "default",
  size = "md",
  shape = "pill",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant, size, shape }), className),
      },
      props,
    ),
    render,
    state: {
      slot: "badge",
      variant,
      size,
      shape,
    },
  });
}

export { Badge, badgeVariants };
