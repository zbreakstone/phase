"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useScrollFade } from "@/lib/use-scroll-fade";

/**
 * A scrolling panel whose top and bottom edges fade out while there is more content that way. The
 * fade is a mask on the inner scroller, so the outer element can keep its own background and shadow.
 */
export function ScrollFade({ className, innerClassName, children }: { className?: string; innerClassName?: string; children: React.ReactNode }) {
  const { attach, style } = useScrollFade();

  return (
    <div className={cn("min-h-0 overflow-hidden", className)}>
      <div ref={attach} className="h-full overflow-y-auto" style={style}>
        <div className={innerClassName}>{children}</div>
      </div>
    </div>
  );
}
