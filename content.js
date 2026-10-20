(() => {
  if (window.__rulerOverlayLoaded || window.__guidesOverlay) return;

  const RULER_LEFT = 18;
  const RULER_TOP = 20;
  const GUIDE_GRAB = 7;
  const palettes = {
    orange: { guide: "#df6331", mirror: "#a84a25", accent: "#df6331", readout: "#e6e5de", tag: "#f3f2ec", ink: "#30312c" },
    cyan: { guide: "#008592", mirror: "#00525c", accent: "#008592", readout: "#e2eeec", tag: "#f0f5f3", ink: "#243638" },
    pink: { guide: "#d24d77", mirror: "#8f3150", accent: "#d24d77", readout: "#eee3e7", tag: "#f7eef1", ink: "#382a30" },
    green: { guide: "#82a76a", mirror: "#5a7a44", accent: "#82a76a", readout: "#e7e9df", tag: "#f0f1ea", ink: "#2e352a" },
    blue: { guide: "#4f8fd6", mirror: "#2f6aa8", accent: "#4f8fd6", readout: "#e2e8f0", tag: "#f0f4f8", ink: "#283342" }
  };
  const host = document.createElement("div");
  host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none";
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    *{box-sizing:border-box}.ruler{position:fixed;background:#171a20;color:#f2ece0;pointer-events:auto;font:10px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;user-select:none;touch-action:none}
    #top{left:${RULER_LEFT}px;right:0;top:0;height:${RULER_TOP}px;border-bottom:1px solid #4a4c47;background-image:repeating-linear-gradient(90deg,#f2ece0 0 1px,transparent 1px 100px),repeating-linear-gradient(90deg,#d0cabe 0 1px,transparent 1px 50px),repeating-linear-gradient(90deg,#65655f 0 1px,transparent 1px 10px);background-size:100% 16px,100% 10px,100% 5px;background-repeat:repeat-x}
    #left{top:${RULER_TOP}px;bottom:0;left:0;width:${RULER_LEFT}px;border-right:1px solid #4a4c47;background-image:repeating-linear-gradient(180deg,#f2ece0 0 1px,transparent 1px 100px),repeating-linear-gradient(180deg,#d0cabe 0 1px,transparent 1px 50px),repeating-linear-gradient(180deg,#65655f 0 1px,transparent 1px 10px);background-size:${RULER_LEFT}px 100%,10px 100%,5px 100%;background-repeat:repeat-y}
    #corner{left:0;top:0;width:${RULER_LEFT}px;height:${RULER_TOP}px;z-index:3;cursor:crosshair;background:#171a20;border-right:1px solid #4a4c47;border-bottom:1px solid #4a4c47;border-radius:0 0 10px 0}#corner:after{content:"";position:absolute;left:5px;top:6px;width:8px;height:8px;border-radius:50%;background:var(--palette-accent,#df6331)}
    .label{position:absolute;white-space:nowrap;background:#171a20;padding:1px 2px}.h-label{top:3px}.v-label{left:2px;writing-mode:vertical-rl}.readout{position:fixed;z-index:4;top:${RULER_TOP + 8}px;left:${RULER_LEFT + 10}px;background:#171a20;color:#f2ece0;border:0;padding:4px 7px;border-radius:3px;font:10px ui-monospace,SFMono-Regular,Menlo,monospace;pointer-events:none}
    .guide{position:absolute;pointer-events:auto;touch-action:none}.horizontal{left:${RULER_LEFT}px;right:0;height:${GUIDE_GRAB}px;transform:translateY(-50%);cursor:ns-resize}.vertical{top:${RULER_TOP}px;bottom:0;width:${GUIDE_GRAB}px;transform:translateX(-50%);cursor:ew-resize}:host(.norulers) .vertical{top:0}:host(.norulers) .horizontal{left:0}.line{position:absolute;background:var(--guide-color,#df6331);pointer-events:none}.horizontal .line{height:var(--guide-hairline,1px);left:0;right:0;top:var(--guide-inset,3px)}.vertical .line{width:var(--guide-hairline,1px);top:0;bottom:0;left:var(--guide-inset,3px)}.horizontal .line.mirror{transform:translateY(var(--mirror-shift,0))}.vertical .line.mirror{transform:translateX(var(--mirror-shift,0))}.guide:not(.mirrored) .line.mirror{display:none}
    .tag{position:fixed;background:#171a20;color:#f2ece0;border:0;border-radius:3px;padding:4px 7px;font:10px ui-monospace,SFMono-Regular,Menlo,monospace;pointer-events:none;white-space:nowrap;z-index:5}.hidden{display:none!important}`;
  shadow.append(style);
  const top = document.createElement("div"); top.id = "top"; top.className = "ruler";
  const left = document.createElement("div"); left.id = "left"; left.className = "ruler";
  const corner = document.createElement("div"); corner.id = "corner"; corner.className = "ruler";
  const readout = document.createElement("div"); readout.className = "readout"; readout.textContent = "x 0 · y 0";
  shadow.append(top, left, corner, readout);
  document.documentElement.append(host);

  let active = false, visibleGuides = true, separate = false, mirror = false, paletteName = "orange", guides = [], dragging = null, densityQuery = null;
  const pageKey = `guides:${location.origin}${location.pathname}${location.search}`;
  const storageKey = () => separate ? pageKey : "guides:shared";
  const palette = () => palettes[paletteName] || palettes.orange;
  const documentSize = axis => axis === "v"
    ? Math.max(document.documentElement.scrollWidth, document.documentElement.clientWidth)
    : Math.max(document.documentElement.scrollHeight, document.documentElement.clientHeight);
  const guideColor = guide => {
    let hex = palette().guide.slice(1);
    const extent = documentSize(guide.axis);
    const center = extent / 2;
    const distance = center ? Math.min(1, Math.abs(guide.position - center) / center) : 0;
    const brightness = 1 - 0.3 * distance;
    const channels = hex.match(/.{2}/g).map(channel => Math.round(parseInt(channel, 16) * brightness).toString(16).padStart(2, "0"));
    return `#${channels.join("")}`;
  };
  const applyPalette = () => {
    const colors = palette();
    host.style.setProperty("--palette-accent", colors.accent);
    host.style.setProperty("--palette-ink", colors.ink);
    host.style.setProperty("--readout-bg", colors.readout);
    host.style.setProperty("--tag-bg", colors.tag);
  };
  const save = () => chrome.storage.local.set({ [storageKey()]: guides.map(({ axis, position }) => ({ axis, position })) });
  const renderGuide = guide => { guide.el.style.left = guide.axis === "v" ? `${guide.position - scrollX}px` : ""; guide.el.style.top = guide.axis === "h" ? `${guide.position - scrollY}px` : ""; guide.el.style.setProperty("--guide-color", guideColor(guide)); guide.el.style.setProperty("--mirror-shift", `${2 * (documentSize(guide.axis) / 2 - guide.position)}px`); guide.el.classList.toggle("mirrored", mirror); guide.el.classList.toggle("hidden", !visibleGuides); };
  const renderAll = () => guides.forEach(renderGuide);
  const paint = () => {
    host.classList.toggle("norulers", !active);
    top.replaceChildren(); left.replaceChildren();
    top.style.backgroundPosition = `${-((scrollX + RULER_LEFT) % 100)}px 0,${-((scrollX + RULER_LEFT) % 50)}px 0,${-((scrollX + RULER_LEFT) % 10)}px 0`;
    left.style.backgroundPosition = `0 ${-((scrollY + RULER_TOP) % 100)}px,0 ${-((scrollY + RULER_TOP) % 50)}px,0 ${-((scrollY + RULER_TOP) % 10)}px`;
    top.classList.toggle("hidden", !active); left.classList.toggle("hidden", !active); readout.classList.toggle("hidden", !active); corner.classList.toggle("hidden", !active);
    for (let x = Math.floor((scrollX + RULER_LEFT) / 100) * 100; x < scrollX + innerWidth; x += 100) { const position = x - scrollX - RULER_LEFT + 2; if (position < 0) continue; const label = document.createElement("span"); label.className = "label h-label"; label.style.left = `${position}px`; label.textContent = x; top.append(label); }
    for (let y = Math.floor((scrollY + RULER_TOP) / 100) * 100; y < scrollY + innerHeight; y += 100) { const position = y - scrollY - RULER_TOP + 2; if (position < 0) continue; const label = document.createElement("span"); label.className = "label v-label"; label.style.top = `${position}px`; label.textContent = y; left.append(label); }
    renderAll();
  };
  const makeGuide = ({ axis, position }) => {
    const el = document.createElement("div"); el.className = `guide ${axis === "h" ? "horizontal" : "vertical"}`;
    const line = document.createElement("span"); line.className = "line"; const twin = document.createElement("span"); twin.className = "line mirror"; el.append(line, twin); shadow.append(el);
    const guide = { axis, position: Number(position), el }; guides.push(guide); renderGuide(guide);
    el.addEventListener("pointerdown", event => { if (event.detail > 1) { event.preventDefault(); event.stopPropagation(); editGuide(guide); } else beginDrag(event, guide); });
    el.addEventListener("dblclick", event => { event.stopPropagation(); editGuide(guide); });
    return guide;
  };
  const editGuide = guide => { const value = prompt(`${guide.axis === "v" ? "Vertical" : "Horizontal"} guide position (CSS px)`, String(Math.round(guide.position))); if (value !== null && Number.isFinite(Number(value))) { guide.position = Math.max(0, Number(value)); renderAll(); save(); } };
  const restoreGuides = stored => { guides.forEach(guide => guide.el.remove()); guides = []; (stored[storageKey()] || []).forEach(makeGuide); paint(); };
  const beginDrag = (event, guidesToDrag) => { event.preventDefault(); event.stopPropagation(); dragging = { guides: Array.isArray(guidesToDrag) ? guidesToDrag : [guidesToDrag] }; const target = Array.isArray(guidesToDrag) ? guidesToDrag[0].el : guidesToDrag.el; (event.currentTarget || target).setPointerCapture(event.pointerId); };
  const move = event => {
    if (!active && !dragging) return;
    let cursorX = Math.round(event.clientX + scrollX), cursorY = Math.round(event.clientY + scrollY);
    if (dragging) {
      const positions = dragging.guides.map(guide => {
        const rawPosition = guide.axis === "h" ? event.clientY + scrollY : event.clientX + scrollX;
        guide.position = Math.max(0, event.shiftKey ? Math.round(rawPosition / 10) * 10 : rawPosition);
        if (guide.axis === "h") cursorY = Math.round(guide.position); else cursorX = Math.round(guide.position);
        renderGuide(guide); return `${guide.axis === "h" ? "Y" : "X"} ${Math.round(guide.position)} px`;
      });
      let tag = shadow.querySelector(".tag"); if (!tag) { tag = document.createElement("div"); tag.className = "tag"; shadow.append(tag); }
      tag.textContent = positions.join(" · "); tag.style.left = `${event.clientX + 10}px`; tag.style.top = `${event.clientY + 10}px`;
    }
    readout.textContent = `x ${cursorX} · y ${cursorY}`;
  };
  const finish = event => {
    if (!dragging) return;
    for (const guide of dragging.guides) {
      if ((guide.axis === "h" && event.clientY <= RULER_TOP) || (guide.axis === "v" && event.clientX <= RULER_LEFT)) { guide.el.remove(); guides = guides.filter(item => item !== guide); }
      else if (guides.some(item => item !== guide && item.axis === guide.axis && Math.round(item.position) === Math.round(guide.position))) { guide.el.remove(); guides = guides.filter(item => item !== guide); }
    }
    dragging = null; shadow.querySelector(".tag")?.remove(); renderAll(); save();
  };
  const rulerDown = (axis, event) => { if (!active) return; event.preventDefault(); const position = axis === "h" ? event.clientY + scrollY : event.clientX + scrollX; beginDrag(event, makeGuide({ axis, position })); };
  top.addEventListener("pointerdown", event => rulerDown("h", event));
  left.addEventListener("pointerdown", event => rulerDown("v", event));
  corner.addEventListener("pointerdown", event => { if (!active) return; beginDrag(event, [makeGuide({ axis: "h", position: event.clientY + scrollY }), makeGuide({ axis: "v", position: event.clientX + scrollX })]); });
  shadow.addEventListener("pointermove", move); shadow.addEventListener("pointerup", finish); shadow.addEventListener("pointercancel", finish);
  window.addEventListener("scroll", paint, { passive: true });
  window.addEventListener("resize", () => paint());
  window.addEventListener("pointermove", move); window.addEventListener("pointerup", finish);
  chrome.runtime.onMessage.addListener(message => {
    if (message.type === "toggle") { active = !active; chrome.storage.local.set({ overlayEnabled: active }); if (active) chrome.storage.local.get(storageKey(), restoreGuides); else paint(); }
    if (message.type === "toggle-guides") { visibleGuides = !visibleGuides; chrome.storage.local.set({ guidesVisible: visibleGuides }); paint(); }
    if (message.type === "clear-guides") { guides.forEach(guide => guide.el.remove()); guides = []; save(); }
    if (message.type === "toggle-mirror") { mirror = typeof message.mirror === "boolean" ? message.mirror : !mirror; chrome.storage.local.set({ mirror }); renderAll(); }
    if (message.type === "set-palette") { paletteName = palettes[message.palette] ? message.palette : "orange"; applyPalette(); renderAll(); }
    if (message.type === "set-separate") {
      const current = guides.map(({ axis, position }) => ({ axis, position }));
      chrome.storage.local.set({ [storageKey()]: current }).then(() => {
        separate = message.separate;
        chrome.storage.local.get(storageKey(), stored => {
          if (!stored[storageKey()]) { stored[storageKey()] = current; chrome.storage.local.set({ [storageKey()]: current }); }
          restoreGuides(stored);
        });
      });
    }
  });
  window.__rulerOverlayLoaded = true; window.__guidesOverlay = true;
  applyPalette();
  chrome.storage.local.get(["overlayEnabled", "guidesVisible", "separate", "mirror", "palette", "guideColor"], result => {
    active = result.overlayEnabled === true; visibleGuides = result.guidesVisible !== false; separate = result.separate === true; mirror = result.mirror === true;
    paletteName = palettes[result.palette] ? result.palette : "orange"; applyPalette();
    if (result.palette !== paletteName) chrome.storage.local.set({ palette: paletteName });
    if (result.guideColor) chrome.storage.local.remove("guideColor");
    chrome.storage.local.get(storageKey(), restoreGuides);
  });
})();
