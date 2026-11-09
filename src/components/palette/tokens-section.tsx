"use client";

import * as React from "react";
import { toast } from "sonner";
import { Moon, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Combobox, ComboboxCollection, ComboboxContent, ComboboxGroup, ComboboxGroupLabel, ComboboxItem, ComboboxTrigger } from "@/components/ui/combobox";
import { representativeShade } from "@/lib/palette/overlay";
import { uid } from "@/lib/palette/defaults";
import { TOKEN_PRESETS, addPreset, checkRename, normalizePath, removeToken, updateToken } from "@/lib/palette/tokens";
import type { GeneratedHue, PaletteState, SemanticToken, Shade, TokenRef } from "@/lib/palette/types";
import { cn } from "@/lib/utils";
import { Hint } from "./hint";
import { CollapsibleSection } from "./panel-section";

interface Props {
  state: PaletteState;
  generated: GeneratedHue[];
  /** How swatches are painted under the current view. */
  display: (shade: Shade) => string;
  onApply: (fn: (s: PaletteState) => PaletteState) => void;
}

type PickItem = { value: string; label: string; short: string; swatch: string | null };
type PickGroup = { value: string; items: PickItem[] };

/** Each word of the query has to appear somewhere in the label, so "yel 5" finds Yellow 500. */
const matchesQuery = (item: PickItem, query: string) => {
  const label = item.label.toLowerCase();
  return query.toLowerCase().split(/\s+/).every((word) => label.includes(word));
};

// Picker values are strings: "none", "white", "black", or "<hueId>|all" and "<hueId>|<grade>".
const toValue = (ref: TokenRef | null | undefined) =>
  !ref ? "none" : ref.grade === 0 ? "white" : ref.grade === 1000 ? "black" : `${ref.hueId}|${ref.grade ?? "all"}`;

/** Every semantic token in the palette, grouped by its levels, with what each points at in light and dark. */
export function TokensSection({ state, generated, display, onApply }: Props) {
  const tokens = React.useMemo(() => [...(state.tokens ?? [])].sort((a, b) => a.path.localeCompare(b.path)), [state.tokens]);
  const [draft, setDraft] = React.useState("");
  const [duplicates, setDuplicates] = React.useState<string[]>([]);
  const firstHue = generated[0]?.hue.id ?? "";

  const fromValue = (v: string): TokenRef | null => {
    if (v === "none") return null;
    if (v === "white") return { hueId: firstHue, grade: 0 };
    if (v === "black") return { hueId: firstHue, grade: 1000 };
    const [hueId, g] = v.split("|");
    return { hueId, grade: g === "all" ? null : Number(g) };
  };

  const swatchOf = (ref: TokenRef | null | undefined): string | null => {
    if (!ref) return null;
    if (ref.grade === 0) return "#ffffff";
    if (ref.grade === 1000) return "#000000";
    const g = generated.find((x) => x.hue.id === ref.hueId);
    if (!g) return null;
    const shade = ref.grade === null ? representativeShade(g) : g.shades.find((s) => s.grade === ref.grade);
    return shade ? display(shade) : null;
  };

  // `label` is what the search matches and the trigger shows; `short` is the row text under its color's heading.
  const groups = React.useMemo(() => {
    const basics: PickItem[] = [
      { value: "none", label: "Unassigned", short: "Unassigned", swatch: null },
      { value: "white", label: "White", short: "White", swatch: "#ffffff" },
      { value: "black", label: "Black", short: "Black", swatch: "#000000" },
    ];
    const colors = generated.map((g) => {
      const name = g.hue.name || "Unnamed";
      const rep = representativeShade(g);
      return {
        value: name,
        whole: { value: `${g.hue.id}|all`, label: `${name} (all)`, short: "All steps", swatch: rep ? display(rep) : null } as PickItem,
        items: g.shades
          .filter((s) => !s.anchor)
          .map((s): PickItem => ({ value: `${g.hue.id}|${s.grade}`, label: `${name} ${s.grade}`, short: String(s.grade), swatch: display(s) })),
      };
    });
    const build = (steps: boolean): PickGroup[] => [
      { value: "", items: basics },
      // A dark value is one step, so whole colors are only offered for the main value.
      ...colors.map((c) => ({ value: c.value, items: steps ? c.items : [c.whole, ...c.items] })),
    ];
    return { main: build(false), steps: build(true) };
  }, [generated, display]);

  const picker = (id: string, label: string, ref: TokenRef | null | undefined, onPick: (ref: TokenRef | null) => void, steps: boolean) => {
    const items = steps ? groups.steps : groups.main;
    const value = toValue(ref);
    const selected = items.flatMap((g) => g.items).find((i) => i.value === value) ?? null;
    const swatch = swatchOf(ref);
    return (
      <Combobox
        items={items}
        value={selected}
        onValueChange={(v) => v && onPick(fromValue(v.value))}
        isItemEqualToValue={(a, b) => a.value === b.value}
        filter={matchesQuery}
        autoHighlight
      >
        <ComboboxTrigger id={id} aria-label={label} size="sm" className="w-40 min-w-0">
          <span
            aria-hidden
            className={cn("size-3.5 shrink-0 rounded-sm shadow-(--shadow-border)", !swatch && "bg-[repeating-linear-gradient(45deg,transparent_0_2px,var(--color-border)_2px_3px)]")}
            style={swatch ? { backgroundColor: swatch } : undefined}
          />
          <span className="min-w-0 flex-1 truncate text-left">{selected?.label ?? "Unassigned"}</span>
        </ComboboxTrigger>
        <ComboboxContent placeholder="Search colors" className="max-h-80">
          {(group: PickGroup) => (
            <ComboboxGroup key={group.value || "basics"} items={group.items}>
              {group.value ? <ComboboxGroupLabel>{group.value}</ComboboxGroupLabel> : null}
              <ComboboxCollection>
                {(item: PickItem) => (
                  <ComboboxItem key={item.value} value={item} aria-label={item.label}>
                    <span
                      aria-hidden
                      className={cn("size-3 shrink-0 rounded-sm shadow-(--shadow-border)", !item.swatch && "bg-[repeating-linear-gradient(45deg,transparent_0_2px,var(--color-border)_2px_3px)]")}
                      style={item.swatch ? { backgroundColor: item.swatch } : undefined}
                    />
                    {item.short}
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxContent>
      </Combobox>
    );
  };

  // The field takes one name or a comma-separated list, and adds the list as one edit.
  const draftPaths = (text: string) =>
    Array.from(new Set(text.split(/[,\n]/).map(normalizePath).filter((p): p is string => !!p)));

  const add = (text = draft) => {
    const paths = draftPaths(text);
    if (!paths.length) return;
    const have = new Set(tokens.map((t) => t.path));
    const fresh = paths.filter((p) => !have.has(p));
    const taken = paths.filter((p) => have.has(p));
    if (fresh.length) onApply((s) => ({ ...s, tokens: [...(s.tokens ?? []), ...fresh.map((path) => ({ id: uid("token"), path, light: null }))] }));
    // Names that already exist stay in the field, flagged, so they can be fixed or cleared.
    setDraft(taken.join(", "));
    setDuplicates(taken);
  };

  return (
    <CollapsibleSection id="tokens" title="Tokens" className="space-y-4">
      <p className="text-[11px] text-muted-foreground">
        Semantic names for your colors and steps, like border/subtle or warning. Exports alias them to the palette, so
        border/subtle becomes --color-border-subtle: var(--color-gray-200). You can also tag a color or step from its Details.
      </p>
      {tokens.length ? (
        <ul className="space-y-1">
          {rows(tokens).map((row) =>
            row.kind === "group" ? (
              <li key={`g:${row.path}`} className="pt-1 font-mono text-[11px] text-muted-foreground" style={{ paddingLeft: row.depth * 12 }}>
                {row.name}/
              </li>
            ) : (
              <TokenRow
                key={row.token.id}
                token={row.token}
                depth={row.depth}
                state={state}
                onApply={onApply}
                picker={picker}
              />
            ),
          )}
        </ul>
      ) : null}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Input
            aria-label="New token name"
            aria-invalid={duplicates.length > 0 || undefined}
            aria-describedby={duplicates.length ? "token-add-error" : undefined}
            value={draft}
            placeholder="New tokens, like text/muted, border"
            onChange={(e) => {
              setDraft(e.target.value);
              setDuplicates([]);
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (!/[,\n]/.test(text)) return;
              e.preventDefault();
              add(draft + text);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
            className="h-8 font-mono text-xs"
          />
          <Button variant="outline" size="sm" onClick={() => add()} disabled={!draftPaths(draft).length}>
            <Plus />
            Add
          </Button>
        </div>
        {duplicates.length ? (
          <p id="token-add-error" role="alert" className="text-[11px] text-destructive">
            {duplicates.length === 1
              ? `${duplicates[0]} is already a token. Pick another name.`
              : `${duplicates.join(", ")} are already tokens. Pick other names.`}
          </p>
        ) : null}
      </div>
      {tokens.length ? null : (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="-ml-2" />}>
            <Plus />
            Add a preset set
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            {TOKEN_PRESETS.map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => onApply((s) => addPreset(s, p.id))} className="flex-col items-start gap-0.5">
                <span>{p.label}</span>
                <span className="text-xs text-muted-foreground">{p.description}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </CollapsibleSection>
  );
}

type Row = { kind: "group"; path: string; name: string; depth: number } | { kind: "token"; token: SemanticToken; depth: number };

/** Sorted tokens as a tree: a heading for each level that isn't itself a token, then each token indented under it. */
function rows(tokens: SemanticToken[]): Row[] {
  const out: Row[] = [];
  const paths = new Set(tokens.map((t) => t.path));
  const shown = new Set<string>();
  for (const t of tokens) {
    const levels = t.path.split("/");
    for (let i = 1; i < levels.length; i++) {
      const prefix = levels.slice(0, i).join("/");
      if (shown.has(prefix) || paths.has(prefix)) continue;
      shown.add(prefix);
      out.push({ kind: "group", path: prefix, name: levels[i - 1], depth: i - 1 });
    }
    out.push({ kind: "token", token: t, depth: levels.length - 1 });
  }
  return out;
}

function TokenRow({
  token,
  depth,
  state,
  onApply,
  picker,
}: {
  token: SemanticToken;
  depth: number;
  state: PaletteState;
  onApply: Props["onApply"];
  picker: (id: string, label: string, ref: TokenRef | null | undefined, onPick: (ref: TokenRef | null) => void, steps: boolean) => React.ReactNode;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const leaf = token.path.split("/").pop()!;
  const hasDark = token.dark !== undefined;
  const isStep = token.light !== null && token.light.grade !== null;

  const commit = () => {
    if (draft === null) return;
    const result = checkRename(state, token.id, draft);
    if (result.ok && result.path !== token.path) onApply((s) => updateToken(s, token.id, { path: result.path }));
    else if (!result.ok) toast.error(result.error);
    setDraft(null);
  };

  return (
    <li className="group/token space-y-1" style={{ paddingLeft: depth * 12 }}>
      <div className="flex items-center gap-1">
        <input
          aria-label={`Name of ${token.path}`}
          value={draft ?? leaf}
          title={token.path}
          onFocus={(e) => {
            setDraft(token.path);
            requestAnimationFrame(() => e.target.select());
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(null);
              e.currentTarget.blur();
            }
          }}
          className="h-7 min-w-0 flex-1 rounded-md bg-transparent px-1.5 font-mono text-xs outline-none hover:bg-muted focus-visible:bg-white focus-visible:shadow-(--shadow-default) dark:focus-visible:bg-input/30"
        />
        {picker(`token-${token.id}`, `${token.path} value`, token.light, (ref) => onApply((s) => updateToken(s, token.id, { light: ref, ...(ref?.grade === null ? { dark: undefined } : {}) })), false)}
        <Hint label={!isStep ? "Only a single step can have its own dark value" : hasDark ? "Use the same value in dark mode" : "Give it a different value in dark mode"}>
          <button
            type="button"
            aria-label={hasDark ? `Use the same value for ${token.path} in dark mode` : `Set a dark value for ${token.path}`}
            aria-pressed={hasDark}
            disabled={!isStep}
            onClick={() => onApply((s) => updateToken(s, token.id, { dark: hasDark ? undefined : token.light }))}
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30",
              hasDark && "bg-muted text-foreground",
            )}
          >
            <Moon className="size-3.5" />
          </button>
        </Hint>
        <Hint label={`Delete ${token.path}`}>
          <button
            type="button"
            aria-label={`Delete ${token.path}`}
            onClick={() => onApply((s) => removeToken(s, token.id))}
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 group-focus-within/token:opacity-100 group-hover/token:opacity-100 hover:bg-muted hover:text-destructive focus-visible:opacity-100"
          >
            <Trash2 className="size-3.5" />
          </button>
        </Hint>
      </div>
      {hasDark ? (
        <div className="flex items-center gap-1 pr-16">
          <span className="flex-1 px-1.5 text-[11px] text-muted-foreground">Dark</span>
          {picker(`token-${token.id}-dark`, `${token.path} dark value`, token.dark, (ref) => onApply((s) => updateToken(s, token.id, { dark: ref })), true)}
        </div>
      ) : null}
    </li>
  );
}
