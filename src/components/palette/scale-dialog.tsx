"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ScaleConfig } from "@/lib/palette/types";
import { RulesSettings, StepsSettings, TargetCurve } from "./scale-settings";

interface Props {
  scale: ScaleConfig;
  onChange: (scale: ScaleConfig) => void;
}

export function ScaleDialog({ scale, onChange }: Props) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" className="rounded-none" />}>
        <SlidersHorizontal />
        Scale
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="p-4 pb-3">
          <DialogTitle>Scale and contrast rules</DialogTitle>
          <DialogDescription>The defaults suit most projects. Change these only if you need different steps or stricter contrast.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70dvh] border-t border-border">
          <div className="space-y-6 p-4">
            <Block title="Steps">
              <StepsSettings scale={scale} onChange={onChange} />
            </Block>
            <Block title="Contrast rules">
              <RulesSettings scale={scale} onChange={onChange} />
            </Block>
            <Block title="Luminance targets">
              <TargetCurve scale={scale} referenceY={1} onChange={onChange} />
            </Block>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold tracking-wide uppercase">{title}</h3>
      {children}
    </section>
  );
}
