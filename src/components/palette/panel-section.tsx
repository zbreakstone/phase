import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** One block of the sidebar. The card draws full-width dividers between sections, so padding lives here. */
export function PanelSection({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

/** A setting with its label on the left and its control on the right. */
export function SettingRow({ id, label, children }: { id?: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-4">
      <Label htmlFor={id} className="text-sm font-normal text-muted-foreground">
        {label}
      </Label>
      <div className="flex w-40 shrink-0 justify-end">{children}</div>
    </div>
  );
}
