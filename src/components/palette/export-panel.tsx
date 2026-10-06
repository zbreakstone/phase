"use client";

import * as React from "react";
import { Copy, Download, FileCode2, PackageOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  COLOR_FORMATS,
  type ColorFormat,
  slug,
  toCss,
  toTailwindV3,
  toTailwindV4,
  toTokensJson,
} from "@/lib/export/formats";
import type { GeneratedHue, PaletteState } from "@/lib/palette/types";

interface Props {
  state: PaletteState;
  generated: GeneratedHue[];
}

type Tab = "css" | "json" | "tailwind";

export function ExportPanel({ state, generated }: Props) {
  const [tab, setTab] = React.useState<Tab>("css");
  const [format, setFormat] = React.useState<ColorFormat>("hex");
  const [twVersion, setTwVersion] = React.useState<"v4" | "v3">("v4");
  const [prefix, setPrefix] = React.useState("");

  const cleanPrefix = prefix ? slug(prefix) : "";
  const outputs = React.useMemo(() => {
    if (generated.length === 0) return null;
    return {
      css: { text: toCss(generated, format, cleanPrefix), file: "palette.css", mime: "text/css" },
      json: { text: toTokensJson(state, generated, format), file: "tokens.json", mime: "application/json" },
      tailwind:
        twVersion === "v4"
          ? { text: toTailwindV4(generated, format), file: "theme.css", mime: "text/css" }
          : { text: toTailwindV3(generated, format), file: "tailwind.palette.js", mime: "text/javascript" },
    };
  }, [generated, state, format, twVersion, cleanPrefix]);

  if (!outputs) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center">
        <PackageOpen className="size-8 text-muted-foreground" />
        <p className="font-medium">Nothing to export yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">Add at least one hue and its shades will appear here as CSS variables, design tokens and a Tailwind theme.</p>
      </div>
    );
  }

  const current = outputs[tab];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(current.text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Couldn't access the clipboard. Use Download instead.");
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([current.text], { type: current.mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = current.file;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="export-format" className="text-sm">
            Colour format
          </Label>
          <Select items={COLOR_FORMATS.map((f) => ({ value: f.id, label: f.label }))} value={format} onValueChange={(v) => setFormat(v as ColorFormat)}>
            <SelectTrigger id="export-format" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLOR_FORMATS.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {tab === "css" ? (
          <div className="space-y-1.5">
            <Label htmlFor="css-prefix" className="text-sm">
              Variable prefix
            </Label>
            <Input id="css-prefix" value={prefix} placeholder="optional, e.g. brand" onChange={(e) => setPrefix(e.target.value)} className="w-44" />
          </div>
        ) : null}
        {tab === "tailwind" ? (
          <div className="space-y-1.5">
            <Label className="text-sm">Tailwind version</Label>
            <ToggleGroup value={[twVersion]} onValueChange={(v) => v[0] && setTwVersion(v[0] as "v3" | "v4")} variant="outline" spacing={0} aria-label="Tailwind version">
              <ToggleGroupItem value="v4">v4 @theme</ToggleGroupItem>
              <ToggleGroupItem value="v3">v3 config</ToggleGroupItem>
            </ToggleGroup>
          </div>
        ) : null}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={download}>
            <Download />
            Download
          </Button>
          <Button onClick={copy}>
            <Copy />
            Copy
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="css">CSS variables</TabsTrigger>
          <TabsTrigger value="json">JSON tokens</TabsTrigger>
          <TabsTrigger value="tailwind">Tailwind</TabsTrigger>
        </TabsList>
        {(["css", "json", "tailwind"] as const).map((t) => (
          <TabsContent key={t} value={t}>
            <div className="relative rounded-lg border bg-muted/40">
              <div className="flex items-center gap-1.5 border-b px-3 py-1.5 text-xs text-muted-foreground">
                <FileCode2 className="size-3.5" />
                {outputs[t].file}
              </div>
              <ScrollArea className="h-80">
                <pre className="p-3 font-mono text-xs leading-relaxed">
                  <code>{outputs[t].text}</code>
                </pre>
              </ScrollArea>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
