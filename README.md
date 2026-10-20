# Guides

A Chrome extension that overlays rulers and draggable guides on any webpage, like Illustrator.

## Install

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Select **Load unpacked** and choose this project folder.
4. Open `test/index.html` in Chrome and use the Guides toolbar button or `Alt+R`.

Chrome may ask you to allow file access for the local test page. Alternatively, serve the folder with any local static server and open `/test/` over localhost.

## Use

- Drag from the top ruler for a horizontal guide or the left ruler for a vertical guide.
- Drag from the square where the rulers meet to place a horizontal and vertical crosshair together.
- Drag a guide to move it; drag it back onto its ruler to remove it.
- Double-click a guide to enter its exact position in CSS pixels.
- `Alt+R` toggles the overlay, `Alt+Shift+R` toggles guide visibility, and `Alt+Shift+Backspace` clears guides. Chrome lets you change these under `chrome://extensions/shortcuts`.
- The popup toggles the overlay, clears guides, and sets their colour.
- With **Separate guides per page** off, guides are shared across pages. Turn it on to store a separate set for each page URL. Guides use document coordinates; rulers stay in the viewport.
- Guide colour shades smoothly toward 30% darker at document edges, measured from the horizontal and vertical document centres.

## Manual test checklist

- [ ] Toggle the overlay from the toolbar and with `Alt+R`.
- [ ] Create horizontal and vertical guides, drag them, and confirm the position label follows.
- [ ] Drag from the top-left ruler corner and confirm both guides move together before dropping.
- [ ] Double-click each orientation and enter an exact position.
- [ ] Drop two guides on the same axis and rounded pixel position; confirm they merge into one.
- [ ] Drag guides onto their matching ruler and confirm they disappear.
- [ ] Toggle guide visibility and clear all guides from the popup or shortcuts.
- [ ] Change guide colour in the popup.
- [ ] Hold Shift while drawing or moving a guide and confirm it snaps to the nearest 10 CSS pixels.
- [ ] Leave **Separate guides per page** off, navigate to `test/second.html`, and confirm guides are shared; reload and confirm the ruler overlay remains on.
- [ ] Turn **Separate guides per page** on and confirm each test page restores its own set.
- [ ] Scroll and confirm guides stay attached to document positions while ruler ticks track the page's scroll position.
- [ ] Reload the page, reopen the overlay, and confirm guides are restored.
