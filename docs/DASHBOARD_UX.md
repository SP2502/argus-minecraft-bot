# Argus Dashboard: Production-Grade UX & Interface Design System

## Overview
The Argus Real-Time Dashboard is a production-grade operational console designed for supervising, commanding, and auditing the autonomous Minecraft agent. It rejects toy prototypes and excessive empty spacing in favor of high-density, accessible, and mission-critical telemetry.

---

## 1. Navigation Model & Application Shell

### Structure
- **Global Header (Fixed 56px)**:
  - **Brand Badge**: Argus SVG icon mark + bot identity.
  - **Spatial Context**: Current Minecraft dimension (`Overworld`, `Nether`, `End`) and live 3D coordinates (X, Y, Z).
  - **Telemetry Freshness Monitor**: Real-time heartbeat indicator with dynamic stale-data detection (>10 seconds without stream pulse transitions to Amber Stale).
  - **Connection Status Pill**: WebSocket connection status (`Online`, `Reconnecting`, `Offline`) with round-trip latency in milliseconds.
  - **Global Command Shortcut**: Direct trigger for command palette (`Ctrl+K` / `⌘K`).
  - **Session Lock Controller**: In-page modal lock/unlock with encrypted token management.
- **Collapsible Responsive Sidebar (240px &rarr; 64px)**:
  - **Operations**: Command Deck, Task Center (with live queued count badge), World Radar.
  - **Telemetry & Domains**: Domain Hub (11 operational domains), Storage & Loadout, Observability.
  - **Governance**: Security & Audit, Console Settings.
  - **Collapse Toggle**: Smooth transition with persistent SVG iconography.
- **Persistent Current-Task Strip**:
  - Pinned directly above view content across all pages.
  - Displays currently running mission, step progress bar, and instant Pause / Cancel controls.

---

## 2. Color & Operational Status Semantics

| Status | Visual Semantic | Palette Variables | Application Rule |
| :--- | :--- | :--- | :--- |
| **Idle / Inactive** | Neutral Slate | `--status-idle: #94a3b8` | Used for idle tasks, empty queues, unassigned domains. **NEVER RED OR PINK.** |
| **Active / Healthy** | Emerald / Cyan | `--status-success: #10b981`, `--cyan-400: #00e5ff` | Active directives, healthy subsystems, online connections. |
| **Warning / Caution** | Amber | `--status-warning: #f59e0b` | Tool degradation (<20%), low food, tactical retreat, stale telemetry. |
| **Danger / Critical** | Crimson Red | `--status-danger: #ef4444` | Reserved strictly for health hazards (lava, drowning), task failures, and destructive operations. |
| **Running / Busy** | Electric Blue | `--status-running: #38bdf8` | Active pathfinding, ongoing crafting, mining execution. |

---

## 3. Hard Requirement: 100% SVG Icon & Visualization System

### Standards
- **Standard Geometry**: All icons are authored with `24×24` viewBox, `1.75px` stroke width, `currentColor`, rounded caps, and rounded joins.
- **Strict Prohibition**: Zero emojis, zero raster formats (`.png`, `.jpg`, `.webp`, `.gif`), zero base64 bitmaps, and zero icon fonts.
- **SVG World Radar**: The radar and proximity scanner uses 100% vector SVG rendering (`<circle>`, `<line>`, `<polygon>`, `<text>`) with hardware-accelerated matrix transforms. No Canvas elements are used for primary dashboard visualization.

---

## 4. State Requirements & Transitions

Every data-driven screen and card explicitly supports eight core states:
1. **Loading**: Centered spinning cyan vector indicator with clear descriptor.
2. **Ready**: Stable baseline with populated metrics and operational actions.
3. **Empty**: Styled dashed card with specialized SVG icon, informative title, and prescriptive guidance (no blank 0-cards).
4. **Active**: Pulsing cyan/emerald indicator with live progress percentage.
5. **Paused**: Amber pause indicator with single-click resume control.
6. **Warning**: Amber badge with degradation or low-resource alert.
7. **Error**: Red accent card with specific error message and retry button.
8. **Stale**: Amber warning badge triggered when telemetry stream pauses for >10 seconds.

---

## 5. Keyboard Navigation & Accessibility

- **Focus Rings**: All interactive controls implement high-contrast focus rings (`box-shadow: 0 0 0 2px var(--cyan-400)`).
- **Shortcuts**:
  - `Ctrl+K` / `⌘K`: Focuses the primary Command Deck input from any screen.
  - `ArrowUp` / `ArrowDown`: Recalls previous directives through command history buffer.
  - `Escape`: Closes active detail drawers and modal dialogs.
- **ARIA & Screen Readers**: All icon-only buttons include descriptive `title` and `aria-label` tags.

---

## 6. Responsive Viewport Adaptations

- **1920×1080 (FHD Desktop)**: Full expanded 240px sidebar, split-pane command terminal, dual-column domain cards.
- **1366×768 / 1280×720 (Laptop)**: Adjusted grid columns, fluid radar sizing, preserved density.
- **768px (Tablet)**: Sidebar automatically collapses to 64px icon rail; split terminals stack vertically.
- **390px (Mobile)**: Compact header, hidden coordinate pill, full-width single-column cards, touch-optimized button hit areas (min 44px).
