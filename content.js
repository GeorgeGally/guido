(() => {
  if (window.__rulerOverlayLoaded || window.__guidesOverlay) return;

  const RULER_LEFT = 18;
  const RULER_TOP = 20;
  const GUIDE_GRAB = 7;
  const palettes = {
    orange: { guide: "#df6331", mirror: "#a84a25", accent: "#df6331" },
    cyan: { guide: "#008592", mirror: "#00525c", accent: "#008592" },
    pink: { guide: "#d24d77", mirror: "#8f3150", accent: "#d24d77" },
    green: { guide: "#6c8c55", mirror: "#466132", accent: "#6c8c55" },
    blue: { guide: "#3975b8", mirror: "#214d80", accent: "#3975b8" }
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
    .label{position:absolute;white-space:nowrap;background:#171a20;padding:1px 2px}.h-label{top:3px}.v-label{left:2px;writing-mode:vertical-rl}.readout{position:fixed;z-index:4;top:${RULER_TOP + 8}px;left:${RULER_LEFT + 10}px;background:#171a20;color:#f2ece0;padding:3px 6px;border-radius:3px;font:10px ui-monospace,SFMono-Regular,Menlo,monospace;pointer-events:none}
    .guide{position:absolute;pointer-events:auto;touch-action:none}.horizontal{left:${RULER_LEFT}px;right:0;height:${GUIDE_GRAB}px;transform:translateY(-50%);cursor:ns-resize}.vertical{top:${RULER_TOP}px;bottom:0;width:${GUIDE_GRAB}px;transform:translateX(-50%);cursor:ew-resize}:host(.norulers) .vertical{top:0}:host(.norulers) .horizontal{left:0}.line{position:absolute;background:var(--guide-color,#df6331);pointer-events:none}.horizontal .line{height:var(--guide-hairline,1px);left:0;right:0;top:var(--guide-inset,3px)}.vertical .line{width:var(--guide-hairline,1px);top:0;bottom:0;left:var(--guide-inset,3px)}
    .tag{position:fixed;background:#171a20;color:#f2ece0;border:0;border-radius:3px;padding:3px 6px;font:10px ui-monospace,SFMono-Regular,Menlo,monospace;pointer-events:none;white-space:nowrap;z-index:5}
     .edit{position:fixed;z-index:6;width:52px;padding:4px 7px;border:0;border-radius:3px;outline:none;background:#171a20;color:#f2ece0;caret-color:#f2ece0;font:10px ui-monospace,SFMono-Regular,Menlo,monospace;pointer-events:auto}.edit::selection{background:var(--palette-accent,#df6331);color:#fff}.hidden{display:none!important}`;
  shadow.append(style);
  const top = document.createElement("div"); top.id = "top"; top.className = "ruler";
  const left = document.createElement("div"); left.id = "left"; left.className = "ruler";
  const corner = document.createElement("div"); corner.id = "corner"; corner.className = "ruler";
  const readout = document.createElement("div"); readout.className = "readout"; readout.textContent = "x 0 · y 0";
  shadow.append(top, left, corner, readout);
  document.documentElement.append(host);

  let active = false, visibleGuides = true, mirror = false, separate = false, paletteName = "orange", guides = [], dragging = null, lastGuide = null, densityQuery = null;
  const pageKey = `guides:${location.origin}${location.pathname}${location.search}`;
  const storageKey = () => separate ? pageKey : "guides:shared";
  const palette = () => palettes[paletteName] || palettes.orange;
  const documentSize = axis => axis === "v"
    ? Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0, document.documentElement.clientWidth)
    : Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0, document.documentElement.clientHeight);
  const mirrorPosition = (axis, position) => Math.round(documentSize(axis)) - Math.round(position);
  const linkedGuide = guide => guide.linkId ? guides.find(item => item !== guide && item.linkId === guide.linkId) : null;
  const exactMirror = guide => guides.find(item => item !== guide && item.axis === guide.axis && Math.round(item.position) === mirrorPosition(guide.axis, guide.position));
  const guideColor = guide => {
    const colors = palette();
    const extent = documentSize(guide.axis);
    const center = extent / 2;
    const distance = center ? Math.min(1, Math.abs(guide.position - center) / center) : 0;
    const brightness = 1 - 0.3 * distance;
    const base = linkedGuide(guide) || exactMirror(guide) ? colors.mirror : colors.guide;
    const channels = base.slice(1).match(/.{2}/g).map(channel => Math.round(parseInt(channel, 16) * brightness).toString(16).padStart(2, "0"));
    return `#${channels.join("")}`;
  };
  const applyPalette = () => {
    const colors = palette();
    host.style.setProperty("--palette-accent", colors.accent);
  };
  const save = () => chrome.storage.local.set({ [storageKey()]: guides.map(({ axis, position, linkId, mirrorMaster }) => ({ axis, position, ...(linkId ? { linkId, mirrorMaster } : {}) })) });
  const renderGuide = guide => { guide.el.style.left = guide.axis === "v" ? `${guide.position - scrollX}px` : ""; guide.el.style.top = guide.axis === "h" ? `${guide.position - scrollY}px` : ""; guide.el.style.setProperty("--guide-color", guideColor(guide)); guide.el.classList.toggle("hidden", !visibleGuides); };
  const renderAll = () => guides.forEach(renderGuide);
  const unlinkGuide = guide => { const other = linkedGuide(guide); if (other) { delete other.linkId; delete other.mirrorMaster; } delete guide.linkId; delete guide.mirrorMaster; };
  const removeGuide = guide => { unlinkGuide(guide); guide.el.remove(); guides = guides.filter(item => item !== guide); if (lastGuide === guide) lastGuide = guides.at(-1) || null; renderAll(); save(); };
  const applyGuidePosition = (guide, position) => { guide.position = Math.max(0, Number(position)); const other = linkedGuide(guide); if (other) { guide.mirrorMaster = true; other.mirrorMaster = false; other.position = Math.max(0, mirrorPosition(guide.axis, guide.position)); } renderAll(); save(); };
  const makeGuide = ({ axis, position, linkId, mirrorMaster = false }) => {
    const el = document.createElement("div"); el.className = `guide ${axis === "h" ? "horizontal" : "vertical"}`;
    const line = document.createElement("span"); line.className = "line"; el.append(line); shadow.append(el);
    const guide = { axis, position: Number(position), el, ...(linkId ? { linkId, mirrorMaster } : {}) };
    guides.push(guide); lastGuide = guide; renderGuide(guide);
    el.addEventListener("pointerdown", event => {
      if (event.altKey) { event.preventDefault(); event.stopPropagation(); lastGuide = guide; mirrorGuide(guide); return; }
      if (event.detail > 1) { event.preventDefault(); event.stopPropagation(); editGuide(guide, event); return; }
      beginDrag(event, guide);
    });
    el.addEventListener("dblclick", event => { event.stopPropagation(); editGuide(guide, event); });
    return guide;
  };
  const syncMirrors = () => { for (const guide of guides) { if (!guide.linkId || !guide.mirrorMaster) continue; const other = linkedGuide(guide); if (other) other.position = Math.max(0, mirrorPosition(guide.axis, guide.position)); } };
  const paint = () => {
    host.classList.toggle("norulers", !active);
    top.replaceChildren(); left.replaceChildren();
    top.style.backgroundPosition = `${-((scrollX + RULER_LEFT) % 100)}px 0,${-((scrollX + RULER_LEFT) % 50)}px 0,${-((scrollX + RULER_LEFT) % 10)}px 0`;
    left.style.backgroundPosition = `0 ${-((scrollY + RULER_TOP) % 100)}px,0 ${-((scrollY + RULER_TOP) % 50)}px,0 ${-((scrollY + RULER_TOP) % 10)}px`;
    top.classList.toggle("hidden", !active); left.classList.toggle("hidden", !active); readout.classList.toggle("hidden", !active); corner.classList.toggle("hidden", !active);
    for (let x = Math.floor((scrollX + RULER_LEFT) / 100) * 100; x < scrollX + innerWidth; x += 100) { const position = x - scrollX - RULER_LEFT + 2; if (position < 0) continue; const label = document.createElement("span"); label.className = "label h-label"; label.style.left = `${position}px`; label.textContent = x; top.append(label); }
    for (let y = Math.floor((scrollY + RULER_TOP) / 100) * 100; y < scrollY + innerHeight; y += 100) { const position = y - scrollY - RULER_TOP + 2; if (position < 0) continue; const label = document.createElement("span"); label.className = "label v-label"; label.style.top = `${position}px`; label.textContent = y; left.append(label); }
    syncMirrors(); renderAll();
  };
  const restoreGuides = stored => { guides.forEach(guide => guide.el.remove()); guides = []; (stored[storageKey()] || []).forEach(makeGuide); lastGuide = guides.at(-1) || null; syncMirrors(); paint(); };
  const beginDrag = (event, guidesToDrag) => { event.preventDefault(); event.stopPropagation(); dragging = { guides: Array.isArray(guidesToDrag) ? guidesToDrag : [guidesToDrag] }; const target = Array.isArray(guidesToDrag) ? guidesToDrag[0].el : guidesToDrag.el; (event.currentTarget || target).setPointerCapture(event.pointerId); lastGuide = dragging.guides.at(-1); };
  const linkGuides = (master, twin) => {
    if (!master || !twin || master === twin || Math.round(master.position) === mirrorPosition(master.axis, master.position) || master.linkId || twin.linkId) return false;
    const linkId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    master.linkId = linkId; master.mirrorMaster = true; twin.linkId = linkId; twin.mirrorMaster = false; twin.position = Math.max(0, mirrorPosition(master.axis, master.position));
    renderAll(); save(); return true;
  };
  const mirrorGuide = guide => {
    if (!guide || !guides.includes(guide) || linkedGuide(guide)) return;
    const target = mirrorPosition(guide.axis, guide.position);
    if (target < 0 || target > documentSize(guide.axis) || target === Math.round(guide.position)) return;
    const existing = guides.find(item => item !== guide && item.axis === guide.axis && Math.round(item.position) === target && !item.linkId);
    if (existing) { linkGuides(guide, existing); return; }
    const linkId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    guide.position = Math.round(guide.position); guide.linkId = linkId; guide.mirrorMaster = true;
    makeGuide({ axis: guide.axis, position: target, linkId, mirrorMaster: false }); renderAll(); save();
  };
  const editGuide = (guide, event) => {
    if (shadow.querySelector(".edit")) return;
    const input = document.createElement("input");
    input.className = "edit"; input.type = "text"; input.inputMode = "numeric"; input.value = String(Math.round(guide.position));
    const x = guide.axis === "v" ? guide.position - scrollX + 6 : (event ? event.clientX : 60) + 8;
    const y = guide.axis === "h" ? guide.position - scrollY + 6 : (event ? event.clientY : 60) + 8;
    input.style.left = `${x}px`; input.style.top = `${y}px`; shadow.append(input); input.focus(); input.select();
    let done = false;
    const close = apply => {
      if (done) return;
      done = true;
      const value = Number(input.value.trim());
      if (apply && input.value.trim() !== "" && Number.isFinite(value)) applyGuidePosition(guide, value);
      input.remove();
    };
    input.addEventListener("keydown", event => { event.stopPropagation(); if (event.key === "Enter") close(true); if (event.key === "Escape") close(false); });
    input.addEventListener("blur", () => close(false));
  };
  const mirrorAnchor = (guide, position) => guides.find(item => item !== guide && item.axis === guide.axis && !item.linkId && Math.abs(position - mirrorPosition(item.axis, item.position)) <= 4);
  const updateGuidePosition = (guide, position) => {
    guide.position = Math.max(0, position);
    let other = linkedGuide(guide);
    if (other) { guide.mirrorMaster = true; other.mirrorMaster = false; other.position = Math.max(0, mirrorPosition(guide.axis, guide.position)); return; }
    other = mirrorAnchor(guide, guide.position);
    if (other) { linkGuides(other, guide); guide.position = mirrorPosition(guide.axis, other.position); }
  };
  const dragLabel = guide => { const other = linkedGuide(guide) || exactMirror(guide); const axis = guide.axis === "h" ? "Y" : "X"; return other ? `${axis} ${Math.round(guide.position)} · mirrors ${Math.round(other.position)} px` : `${axis} ${Math.round(guide.position)} px`; };
  const move = event => {
    if (!active && !dragging) return;
    let cursorX = Math.round(event.clientX + scrollX), cursorY = Math.round(event.clientY + scrollY);
    if (dragging) {
      for (const guide of dragging.guides) {
        let position = guide.axis === "h" ? event.clientY + scrollY : event.clientX + scrollX;
        if (event.shiftKey) position = Math.round(position / 10) * 10;
        updateGuidePosition(guide, position);
        if (guide.axis === "h") cursorY = Math.round(guide.position); else cursorX = Math.round(guide.position);
      }
      renderAll();
      let tag = shadow.querySelector(".tag"); if (!tag) { tag = document.createElement("div"); tag.className = "tag"; shadow.append(tag); }
      tag.textContent = dragging.guides.map(dragLabel).join(" · "); tag.style.left = `${event.clientX + 10}px`; tag.style.top = `${event.clientY + 10}px`;
    }
    readout.textContent = `x ${cursorX} · y ${cursorY}`;
  };
  const finish = event => {
    if (!dragging) return;
    for (const guide of [...dragging.guides]) {
      if ((guide.axis === "h" && event.clientY <= RULER_TOP) || (guide.axis === "v" && event.clientX <= RULER_LEFT)) removeGuide(guide);
      else if (guides.some(item => item !== guide && item.axis === guide.axis && Math.round(item.position) === Math.round(guide.position))) removeGuide(guide);
    }
    dragging = null; shadow.querySelector(".tag")?.remove(); syncMirrors(); renderAll(); save();
  };
  const rulerDown = (axis, event) => {
    if (!active) return;
    event.preventDefault();
    const position = axis === "h" ? event.clientY + scrollY : event.clientX + scrollX;
    const guide = makeGuide({ axis, position });
    if (mirror) mirrorGuide(guide);
    beginDrag(event, guide);
  };
  const selectPalette = name => { paletteName = palettes[name] ? name : "orange"; applyPalette(); renderAll(); };
  const handleMessage = message => {
    if (message.type === "toggle") { active = !active; chrome.storage.local.set({ overlayEnabled: active }); if (active) chrome.storage.local.get(storageKey(), restoreGuides); else paint(); }
    if (message.type === "toggle-guides") { visibleGuides = !visibleGuides; chrome.storage.local.set({ guidesVisible: visibleGuides }); paint(); }
    if (message.type === "clear-guides") { guides.forEach(guide => guide.el.remove()); guides = []; lastGuide = null; save(); }
    if (message.type === "set-palette") selectPalette(message.palette);
    if (message.type === "toggle-mirror") { mirror = !mirror; chrome.storage.local.set({ mirror }); }
    if (message.type === "set-separate") {
      const current = guides.map(({ axis, position, linkId, mirrorMaster }) => ({ axis, position, ...(linkId ? { linkId, mirrorMaster } : {}) }));
      chrome.storage.local.set({ [storageKey()]: current }).then(() => {
        separate = message.separate;
        chrome.storage.local.get(storageKey(), stored => { if (!stored[storageKey()]) { stored[storageKey()] = current; chrome.storage.local.set({ [storageKey()]: current }); } restoreGuides(stored); });
      });
    }
  };
  const updateDensity = () => {
    const hairline = 1 / Math.max(1, devicePixelRatio || 1);
    host.style.setProperty("--guide-hairline", `${hairline}px`);
    host.style.setProperty("--guide-inset", `${(GUIDE_GRAB - hairline) / 2}px`);
    densityQuery?.removeEventListener("change", updateDensity);
    densityQuery = matchMedia(`(resolution: ${devicePixelRatio || 1}dppx)`);
    densityQuery.addEventListener("change", updateDensity, { once: true });
  };

  top.addEventListener("pointerdown", event => rulerDown("h", event));
  left.addEventListener("pointerdown", event => rulerDown("v", event));
  corner.addEventListener("pointerdown", event => {
    if (!active) return;
    const horizontal = makeGuide({ axis: "h", position: event.clientY + scrollY });
    const vertical = makeGuide({ axis: "v", position: event.clientX + scrollX });
    if (mirror) { mirrorGuide(horizontal); mirrorGuide(vertical); }
    beginDrag(event, [horizontal, vertical]);
  });
  shadow.addEventListener("pointermove", move); shadow.addEventListener("pointerup", finish); shadow.addEventListener("pointercancel", finish);
  window.addEventListener("scroll", paint, { passive: true });
  window.addEventListener("resize", () => { updateDensity(); syncMirrors(); paint(); save(); });
  window.addEventListener("pointermove", move); window.addEventListener("pointerup", finish);
  chrome.runtime.onMessage.addListener(handleMessage);
  window.__rulerOverlayLoaded = true; window.__guidesOverlay = true;
  updateDensity(); applyPalette();
  chrome.storage.local.get(["overlayEnabled", "guidesVisible", "mirror", "separate", "palette", "guideColor"], result => {
    active = result.overlayEnabled === true; visibleGuides = result.guidesVisible !== false; mirror = result.mirror === true; separate = result.separate === true;
    paletteName = palettes[result.palette] ? result.palette : "orange"; applyPalette();
    if (result.palette !== paletteName) chrome.storage.local.set({ palette: paletteName });
    if (result.guideColor) chrome.storage.local.remove("guideColor");
    chrome.storage.local.get(storageKey(), restoreGuides);
  });
})();
