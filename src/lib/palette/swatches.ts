/** Quick-pick colors for starting a new hue, grouped by mood. Nine per group, so each fills one row. */
export interface Swatch {
  name: string;
  hex: string;
}

export interface SwatchGroup {
  id: string;
  label: string;
  swatches: Swatch[];
}

const s = (name: string, hex: string): Swatch => ({ name, hex });

export const SWATCH_GROUPS: SwatchGroup[] = [
  {
    id: "neutrals",
    label: "Neutrals",
    swatches: [
      s("Black", "#111111"),
      s("Charcoal", "#3a3a3c"),
      s("Slate", "#64748b"),
      s("Stone", "#78716c"),
      s("Zinc", "#a1a1aa"),
      s("Silver", "#c4c7cc"),
      s("Mist", "#e2e4e8"),
      s("Linen", "#ebe5da"),
      s("White", "#fafafa"),
    ],
  },
  {
    id: "bright",
    label: "High visibility",
    swatches: [
      s("Signal red", "#ff2d2d"),
      s("Safety orange", "#ff6a00"),
      s("Hi-vis yellow", "#ffe600"),
      s("Lime", "#b6ff00"),
      s("Neon green", "#2bff6a"),
      s("Aqua", "#00f0d0"),
      s("Electric blue", "#0a84ff"),
      s("Ultraviolet", "#7a2cff"),
      s("Hot pink", "#ff2db4"),
    ],
  },
  {
    id: "pastels",
    label: "Pastels",
    swatches: [
      s("Blush", "#ffc9d4"),
      s("Peach", "#ffd6b8"),
      s("Butter", "#fff1a8"),
      s("Mint", "#c4f0d0"),
      s("Seafoam", "#bdeee4"),
      s("Sky", "#bfe0ff"),
      s("Periwinkle", "#cfd2ff"),
      s("Lavender", "#e0c8ff"),
      s("Orchid", "#f3c6ec"),
    ],
  },
  {
    id: "earth",
    label: "Earth tones",
    swatches: [
      s("Clay", "#b5573a"),
      s("Terracotta", "#c8794a"),
      s("Ochre", "#c9972b"),
      s("Olive", "#7d7a2e"),
      s("Moss", "#566b3a"),
      s("Sage", "#8a9f7b"),
      s("Driftwood", "#9c8468"),
      s("Umber", "#6b4a35"),
      s("Sand", "#d8c3a0"),
    ],
  },
  {
    id: "jewel",
    label: "Jewel tones",
    swatches: [
      s("Ruby", "#b0123c"),
      s("Garnet", "#7e1f3a"),
      s("Amber", "#d98a0b"),
      s("Emerald", "#0a8754"),
      s("Jade", "#0f9d8a"),
      s("Sapphire", "#1743b8"),
      s("Amethyst", "#7b3fc4"),
      s("Tanzanite", "#4b3bb0"),
      s("Magenta", "#b8218f"),
    ],
  },
];
