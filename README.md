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
- Drag a guide to move it; drag it back onto its ruler to remove it.
- Double-click a guide to enter its exact position in CSS pixels.
- `Alt+R` toggles the overlay, `Alt+Shift+R` toggles guide visibility, and `Alt+Shift+Backspace` clears guides. Chrome lets you change these under `chrome://extensions/shortcuts`.
- The popup toggles the overlay, clears guides, and sets their colour.
- Guides are saved per page URL in `chrome.storage.local` and use document coordinates; rulers stay in the viewport.

## Manual test checklist

- [ ] Toggle the overlay from the toolbar and with `Alt+R`.
- [ ] Create horizontal and vertical guides, drag them, and confirm the position label follows.
- [ ] Double-click each orientation and enter an exact position.
- [ ] Drag guides onto their matching ruler and confirm they disappear.
- [ ] Toggle guide visibility and clear all guides from the popup or shortcuts.
- [ ] Change guide colour in the popup.
- [ ] Scroll and confirm guides stay attached to document positions while ruler ticks track the page's scroll position.
- [ ] Reload the page, reopen the overlay, and confirm guides are restored.
