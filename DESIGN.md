# Frank and Bang — Design System (`DESIGN.md`)

## Visual World: Bio-Industrial Copper & Radioactive Lab

Frank and Bang combines two visual registers:
1. **Bio-Experimental Monstrous Lab:** Deep charcoal-graphite surfaces (never `#000000`) illuminated by concentrated radioactive bio-green (`#52FF2E`) containment discharges.
2. **Cyberpunk Industrial Hardware:** Tarnished bronze and brushed copper (`#D47E3F` / `#EB9C5C`) precision markings, 1px hairline technical blueprint sheets that fade at all 4 edges into `#16161B`, `0px` corners (`rounded-none`), zero nested boxes, and solid 4-tone isometric `/anatomy` mechanical assemblies on `#15151A` dot-grid plates.

## Color Palette

| Role | Token | Hex / Value | Usage |
| :--- | :--- | :--- | :--- |
| Canvas Ground | `--bg-canvas` | `#141418` | Global page background (non-black charcoal) |
| Sheet Fade Boundary | `--bg-sheet` | `#16161B` | Edge fade target for 1px hairline grid dividers |
| Blueprint Dot Cell | `--bg-dot-cell` | `#15151A` | Technical grid cells & isometric figure plates |
| Machined Plate | `--bg-plate` | `#1B1C22` | Structural interactive containers |
| Elevated Plate | `--bg-plate-elevated` | `#22242C` | Active buttons, tabs, and focused surfaces |
| Isometric Shades 0..3 | `--iso-shade-0..3` | `#181920`, `#1E2028`, `#252731`, `#2E313D` | 4-tone shaded isometric metal mechanisms |
| Radioactive Bio-Green | `--bio-green` | `#52FF2E` | Primary lab focal light, active turn/equip state, Unique tier |
| Bio-Green Secondary | `--bio-green-mid` | `#32C81E` | Hover & secondary active controls |
| Cyberpunk Copper | `--copper` | `#D47E3F` | Industrial focal metal, Rare tier, artillery charge & Gacha action |
| Copper Highlight | `--copper-hi` | `#EB9C5C` | Bright copper hover & high-contrast telemetry |
| Tarnished Bronze | `--copper-lo` | `#8A4C24` | Structural borders and copper frame accents |
| Primary Ink | `--ink-primary` | `#ECEAE4` | Headings & high-contrast labels (>= 12:1 on `#15151A`) |
| Secondary Ink | `--ink-secondary` | `#B0AEA6` | Body copy & descriptions (>= 7.5:1) |
| Muted Telemetry | `--ink-muted` | `#8E8D86` | Corner annotations `FIG_01..FIG_04`, units (>= 4.8:1) |
| Critical / Damage | `--danger` | `#E84A5F` | Errors, damage stats, sign-out hover |

## Typography

- **Display (`--font-display`):** `Chakra Petch` (600, 700) — angular industrial headings without kickers/eyebrows above `<h1>`/`<h2>`.
- **Body (`--font-sans`):** `Barlow` (400, 500, 600, 700) — crisp technical prose and UI controls.
- **Telemetry / Annotations (`--font-mono`):** `JetBrains Mono` (400, 500, 700) — `FIG_01..FIG_04`, `tabular-nums`, room codes, stat readouts.

## Layout & Motion Rules

- **Zero `border-radius`** and **no nested boxes** on technical blueprint views.
- **1px fading hairlines** (`.sheet-rule-h`, `.sheet-rule-v`) fading cleanly toward `#16161B`.
- **Solid Isometric Mechanisms (`/anatomy`):** Every blueprint figure uses solid extruded 4-tone graphite geometry with one lit focal element (`#52FF2E` or `#D47E3F`) and pauses animations when scrolled offscreen via `IntersectionObserver`.
- **TCG Booster Pack Popout (`motion` + `/anatomy`):** Clicking "Abrir Sobre" tears open a solid isometric copper/bio-green booster pouch and reveals a draggable/swipeable 3-card stack via `motion/react`.
- **Arena Preservation:** Active 2D Worms gameplay, camera zoom/pan, and physics remain unchanged; only sky, terrain, aiming arc, minimap, and HUD colors adapt to the graphite + bio-green + copper palette.
