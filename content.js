(() => {
  if (window.__rulerOverlayLoaded || window.__guidesOverlay) return;

  const RULER_LEFT = 18;
  const RULER_TOP = 20;
  const GUIDE_GRAB = 7;
  const palettes = {
    braun: { guide: "#df6331", accent: "#df6331", readout: "#e6e5de", tag: "#f3f2ec", ink: "#30312c" },
    cyan: { guide: "#008592", accent: "#008592", readout: "#e2eeec", tag: "#f0f5f3", ink: "#243638" },
    graphite: { guide: "#73756e", accent: "#55564f", readout: "#e3e3dc", tag: "#f1f1eb", ink: "#2b2c28" }
  };
  const host = document.createElement("div");
  host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none";
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    *{box-sizing:border-box}.ruler{position:fixed;background:#dfded6;color:#55564f;pointer-events:auto;font:10px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;user-select:none;touch-action:none}
    #top{left:${RULER_LEFT}px;right:0;top:0;height:${RULER_TOP}px;border-bottom:1px solid #c9c9c1;background-image:repeating-linear-gradient(90deg,#74776f 0 1px,transparent 1px 100px),repeating-linear-gradient(90deg,#969890 0 1px,transparent 1px 50px),repeating-linear-gradient(90deg,#b1b2ab 0 1px,transparent 1px 10px);background-size:100% 16px,100% 10px,100% 5px;background-repeat:repeat-x}
    #left{top:${RULER_TOP}px;bottom:0;left:0;width:${RULER_LEFT}px;border-right:1px solid #c9c9c1;background-image:repeating-linear-gradient(180deg,#74776f 0 1px,transparent 1px 100px),repeating-linear-gradient(180deg,#969890 0 1px,transparent 1px 50px),repeating-linear-gradient(180deg,#b1b2ab 0 1px,transparent 1px 10px);background-size:${RULER_LEFT}px 100%,10px 100%,5px 100%;background-repeat:repeat-y}
    #corner{left:0;top:0;width:${RULER_LEFT}px;height:${RULER_TOP}px;z-index:3;cursor:crosshair;background:#dfded6;border-right:1px solid #c9c9c1;border-bottom:1px solid #c9c9c1;border-radius:0 0 10px 0}#corner:after{content:"";position:absolute;left:5px;top:6px;width:8px;height:8px;border-radius:50%;background:var(--palette-accent,#df6331)}
    .label{position:absolute;white-space:nowrap;background:#dfded6;padding:1px 2px}.h-label{top:3px}.v-label{left:2px;writing-mode:vertical-rl}.readout{position:fixed;z-index:4;top:${RULER_TOP + 8}px;left:${RULER_LEFT + 10}px;background:var(--readout-bg,#e6e5de);color:var(--palette-ink,#30312c);border:1px solid #c9c9c1;padding:3px 6px;border-radius:2px;font:10px ui-monospace,SFMono-Regular,Menlo,monospace;pointer-events:none}
    .guide{position:absolute;pointer-events:auto;touch-action:none}.horizontal{left:${RULER_LEFT}px;right:0;height:${GUIDE_GRAB}px;transform:translateY(-50%);cursor:ns-resize}.vertical{top:${RULER_TOP}px;bottom:0;width:${GUIDE_GRAB}px;transform:translateX(-50%);cursor:ew-resize}.line{position:absolute;background:var(--guide-color,#df6331);pointer-events:none}.horizontal .line{height:var(--guide-hairline,1px);left:0;right:0;top:var(--guide-inset,3px)}.vertical .line{width:var(--guide-hairline,1px);top:0;bottom:0;left:var(--guide-inset,3px)}
    .tag{position:fixed;background:var(--tag-bg,#f3f2ec);color:var(--palette-ink,#30312c);border:1px solid #c9c9c1;border-radius:3px;padding:3px 6px;font:10px ui-monospace,SFMono-Regular,Menlo,monospace;pointer-events:none;white-space:nowrap;z-index:5}.hidden{display:none!important}`;
  shadow.append(style);
  const top = document.createElement("div"); top.id = "top"; top.className = "ruler";
  const left = document.createElement("div"); left.id = "left"; left.className = "ruler";
  const corner = document.createElement("div"); corner.id = "corner"; corner.className = "ruler";
  const readout = document.createElement("div"); readout.className = "readout"; readout.textContent = "x 0 · y 0";
  shadow.append(top, left, corner, readout);
  document.documentElement.append(host);

  let active = false, visibleGuides = true, separate = false, paletteName = "braun", guides = [], dragging = null, densityQuery = null;
  const pageKey = `guides:${location.origin}${location.pathname}${location.search}`;
  const storageKey = () => separate ? pageKey : "guides:shared";
  const palette = () => palettes[paletteName] || palettes.braun;
  const documentSize = axis => axis === "v"
    ? Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0, document.documentElement.clientWidth, innerWidth)
    : Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0, document.documentElement.clientHeight, innerHeight);
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
  const renderGuide = guide => { guide.el.style.left = guide.axis === "v" ? `${guide.position - scrollX}px` : ""; guide.el.style.top = guide.axis === "h" ? `${guide.position - scrollY}px` : ""; guide.el.style.setProperty("--guide-color", guideColor(guide)); guide.el.classList.toggle("hidden", !active || !visibleGuides); };
  const renderAll = () => guides.forEach(renderGuide);
  const paint = () => {
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
    const line = document.createElement("span"); line.className = "line"; el.append(line); shadow.append(el);
    const guide = { axis, position: Number(position), el }; guides.push(guide); renderGuide(guide);
    el.addEventListener("pointerdown", event => { if (event.detail > 1) { event.preventDefault(); event.stopPropagation(); editGuide(guide); } else beginDrag(event, guide); });
    el.addEventListener("dblclick", event => { event.stopPropagation(); editGuide(guide); });
    return guide;
  };
  const editGuide = guide => { const value = prompt(`${guide.axis === "v" ? "Vertical" : "Horizontal"} guide position (CSS px)`, String(Math.round(guide.position))); if (value !== null && Number.isFinite(Number(value))) { guide.position = Math.max(0, Number(value)); renderAll(); save(); } };
  const restoreGuides = stored => { guides.forEach(guide => guide.el.remove()); guides = []; (stored[storageKey()] || []).forEach(makeGuide); paint(); };
  const beginDrag = (event, guidesToDrag) => { event.preventDefault(); event.stopPropagation(); dragging = { guides: Array.isArray(guidesToDrag) ? guidesToDrag : [guidesToDrag] }; const target = Array.isArray(guidesToDrag) ? guidesToDrag[0].el : guidesToDrag.el; (event.currentTarget || target).setPointerCapture(event.pointerId); };
  const updateDensity = () => {
    const hairline = 1 / Math.max(1, devicePixelRatio || 1);
    host.style.setProperty("--guide-hairline", `${hairline}px`);
    host.style.setProperty("--guide-inset", `${(GUIDE_GRAB - hairline) / 2}px`);
    densityQuery?.removeEventListener("change", updateDensity);
    densityQuery = matchMedia(`(resolution: ${devicePixelRatio || 1}dppx)`);
    densityQuery.addEventListener("change", updateDensity, { once: true });
  };
  const move = event => {
    if (!active) return;
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
  window.addEventListener("resize", () => { updateDensity(); paint(); });
  window.addEventListener("pointermove", move); window.addEventListener("pointerup", finish);
  chrome.runtime.onMessage.addListener(message => {
    if (message.type === "toggle") { active = !active; chrome.storage.local.set({ overlayEnabled: active }); if (active) chrome.storage.local.get(storageKey(), restoreGuides); else paint(); }
    if (message.type === "toggle-guides") { visibleGuides = !visibleGuides; chrome.storage.local.set({ guidesVisible: visibleGuides }); paint(); }
    if (message.type === "clear-guides") { guides.forEach(guide => guide.el.remove()); guides = []; save(); }
    if (message.type === "set-palette") { paletteName = palettes[message.palette] ? message.palette : "braun"; applyPalette(); renderAll(); }
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
  updateDensity(); applyPalette();
  chrome.storage.local.get(["overlayEnabled", "guidesVisible", "separate", "palette", "guideColor"], result => {
    active = result.overlayEnabled === true; visibleGuides = result.guidesVisible !== false; separate = result.separate === true;
    paletteName = palettes[result.palette] ? result.palette : "braun"; applyPalette();
    if (result.palette !== paletteName) chrome.storage.local.set({ palette: paletteName });
    if (result.guideColor) chrome.storage.local.remove("guideColor");
    chrome.storage.local.get(storageKey(), restoreGuides);
  });
})();
