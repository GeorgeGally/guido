# ruler.

Rulers and guides for any web page. A Chrome extension for checking layouts, margins and alignment on live sites.

![Ruler on a web page: rulers along the top and left, orange guides, mirrored margins](docs/screenshots/hero.png)

<img src="docs/screenshots/popup.png" alt="The Ruler dropdown: Rulers, Guides visible, Mirror, Separate per page, Palette and Clear guides" width="320" align="right">

## What it does

- **Rulers** along the top and left edges, in CSS pixels, that follow the page as you scroll.
- **Guides** you drag out of either ruler. Drag from the corner square to place a horizontal and a vertical guide together.
- **Exact positions.** Hold Shift to snap to every 10 px. Double-click a guide to type its position.
- **Mirror.** With Mirror on, every guide gets a twin at the same distance from the opposite edge, which makes equal left and right page margins easy.
- **Shading.** Guides get slightly darker towards the edges of the page, so you can tell the outer ones from the inner ones at a glance.
- **Palettes.** Orange, Cyan, Pink, Green or Blue.
- **Guides stay put.** They are saved and shared across pages, or kept per page if you turn on *Separate per page*. Turning the rulers off leaves your guides on screen.

<br clear="right">

## Install

1. Download or clone this repository.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and choose this folder.
4. Pin Ruler from the puzzle-piece menu.

After an update, click the reload arrow on Ruler's card in `chrome://extensions`.

## Shortcuts

| Keys | Action |
| --- | --- |
| `Alt+R` | Rulers on or off |
| `Alt+Shift+R` | Show or hide guides |
| `Alt+Shift+C` | Clear all guides |

Change them at `chrome://extensions/shortcuts`.

## Using guides

- Drag a guide to move it. Drag it back onto its ruler to remove it.
- Two guides dropped on the same pixel merge into one.
- Guides use page coordinates, so they stay on the same spot of the page when you scroll.

## Development

Plain JavaScript, no build step: `content.js` draws the rulers and guides, `popup.html` / `popup.css` / `popup.js` are the dropdown, and `background.js` handles the shortcuts. `test/index.html` and `test/second.html` are pages for trying it out.
