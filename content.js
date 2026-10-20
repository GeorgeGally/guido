(() => {
  if (window.__guidesOverlay) return;

  const RULER_LEFT = 18;
  const RULER_TOP = 20;
  const host = document.createElement("div");
  host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none";
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    *{box-sizing:border-box} .ruler{position:fixed;background:#171a20;color:#f2f5f7;pointer-events:auto;box-shadow:0 1px 5px #0008;font:10px/1.2 Arial,sans-serif;user-select:none;touch-action:none}
    #top{left:${RULER_LEFT}px;right:0;top:0;height:${RULER_TOP}px;border-bottom:1px solid #ffffff45;background-image:repeating-linear-gradient(90deg,#edf2f7 0 1px,transparent 1px 100px),repeating-linear-gradient(90deg,#c5cdd5 0 1px,transparent 1px 50px),repeating-linear-gradient(90deg,#87929e 0 1px,transparent 1px 10px);background-size:100% 18px,100% 11px,100% 6px;background-repeat:repeat-x}
    #left{top:${RULER_TOP}px;bottom:0;left:0;width:${RULER_LEFT}px;border-right:1px solid #ffffff45;background-image:repeating-linear-gradient(180deg,#edf2f7 0 1px,transparent 1px 100px),repeating-linear-gradient(180deg,#c5cdd5 0 1px,transparent 1px 50px),repeating-linear-gradient(180deg,#87929e 0 1px,transparent 1px 10px);background-size:${RULER_LEFT}px 100%,11px 100%,6px 100%;background-repeat:repeat-y}
    #corner{left:0;top:0;width:${RULER_LEFT}px;height:${RULER_TOP}px;z-index:2;cursor:crosshair;background:#171a20;border-right:1px solid #ffffff45;border-bottom:1px solid #ffffff45}
    .label{position:absolute;white-space:nowrap;background:#171a20;padding:1px 2px}.h-label{top:1px}.v-label{left:1px;writing-mode:vertical-rl}.readout{position:fixed;z-index:4;top:${RULER_TOP + 2}px;left:${RULER_LEFT + 4}px;background:#171a20;color:white;padding:4px 6px;border-radius:2px;font:11px Arial;pointer-events:none}
    .guide{position:absolute;pointer-events:auto;touch-action:none}.horizontal{left:${RULER_LEFT}px;right:0;height:7px;transform:translateY(-50%);cursor:ns-resize}.vertical{top:${RULER_TOP}px;bottom:0;width:7px;transform:translateX(-50%);cursor:ew-resize}.line{position:absolute;background:var(--guide-color,#00e5ff);box-shadow:0 0 1px #000;pointer-events:none}.horizontal .line{height:1px;left:0;right:0;top:3px}.vertical .line{width:1px;top:0;bottom:0;left:3px}.tag{position:fixed;background:#10161b;color:#fff;padding:3px 5px;font:11px Arial;pointer-events:none;white-space:nowrap;z-index:5}.hidden{display:none!important}`;
  shadow.append(style);
  const top = document.createElement("div"); top.id = "top"; top.className = "ruler";
  const left = document.createElement("div"); left.id = "left"; left.className = "ruler";
  const corner = document.createElement("div"); corner.id = "corner"; corner.className = "ruler";
  const readout = document.createElement("div"); readout.className = "readout"; readout.textContent = "x 0 · y 0";
  shadow.append(top, left, corner, readout);
  document.documentElement.append(host);

  let active = false, visibleGuides = true, separate = false, color = "#00e5ff", guides = [], dragging = null;
  const pageKey = `guides:${location.origin}${location.pathname}${location.search}`;
  const storageKey = () => separate ? pageKey : "guides:shared";
  const guideColor = guide => {
    let hex = color.slice(1);
    if (hex.length === 3) hex = [...hex].map(value => value + value).join("");
    if (!/^[0-9a-f]{6}$/i.test(hex)) return color;
    const width = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0, innerWidth);
    const height = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0, innerHeight);
    const center = (guide.axis === "v" ? width : height) / 2;
    const distance = center ? Math.min(1, Math.abs(guide.position - center) / center) : 0;
    const brightness = 1 - 0.3 * distance;
    const channels = hex.match(/.{2}/g).map(channel => Math.round(parseInt(channel, 16) * brightness).toString(16).padStart(2, "0"));
    return `#${channels.join("")}`;
  };
  const editGuide = guide => { const value = prompt("Guide position (CSS px)", String(Math.round(guide.position))); if (value !== null && Number.isFinite(Number(value))) { guide.position = Math.max(0, Number(value)); renderGuide(guide); save(); } };
  const makeGuide = ({ axis, position }) => {
    const el = document.createElement("div");
    el.className = `guide ${axis === "h" ? "horizontal" : "vertical"}`;
    el.style.setProperty("--guide-color", color);
    const line = document.createElement("span"); line.className = "line"; el.append(line);
    shadow.append(el);
    const guide = { axis, position, el };
    guides.push(guide); renderGuide(guide);
    el.addEventListener("pointerdown", event => { if (event.detail > 1) { event.preventDefault(); event.stopPropagation(); editGuide(guide); } else beginDrag(event, guide); });
    el.addEventListener("dblclick", event => { event.stopPropagation(); editGuide(guide); });
  };
  const renderGuide = guide => { guide.el.style.left = guide.axis === "v" ? `${guide.position - scrollX}px` : ""; guide.el.style.top = guide.axis === "h" ? `${guide.position - scrollY}px` : ""; guide.el.style.setProperty("--guide-color", guideColor(guide)); guide.el.classList.toggle("hidden", !active || !visibleGuides); };
  const save = () => chrome.storage.local.set({ [storageKey()]: guides.map(({ axis, position }) => ({ axis, position })) });
  const restoreGuides = stored => { guides.forEach(guide => guide.el.remove()); guides = []; (stored[storageKey()] || []).forEach(makeGuide); paint(); };
  const paint = () => {
    top.replaceChildren(); left.replaceChildren();
    top.style.backgroundPosition = `${-((scrollX + RULER_LEFT) % 100)}px 0,${-((scrollX + RULER_LEFT) % 50)}px 0,${-((scrollX + RULER_LEFT) % 10)}px 0`;
    left.style.backgroundPosition = `0 ${-((scrollY + RULER_TOP) % 100)}px,0 ${-((scrollY + RULER_TOP) % 50)}px,0 ${-((scrollY + RULER_TOP) % 10)}px`;
    top.classList.toggle("hidden", !active); left.classList.toggle("hidden", !active); readout.classList.toggle("hidden", !active);
    corner.classList.toggle("hidden", !active);
    for (let x = Math.floor((scrollX + RULER_LEFT) / 100) * 100; x < scrollX + innerWidth; x += 100) { const position = x - scrollX - RULER_LEFT + 2; if (position < 0) continue; const label = document.createElement("span"); label.className = "label h-label"; label.style.left = `${position}px`; label.textContent = x; top.append(label); }
    for (let y = Math.floor((scrollY + RULER_TOP) / 100) * 100; y < scrollY + innerHeight; y += 100) { const position = y - scrollY - RULER_TOP + 2; if (position < 0) continue; const label = document.createElement("span"); label.className = "label v-label"; label.style.top = `${position}px`; label.textContent = y; left.append(label); }
    guides.forEach(renderGuide);
  };
  const beginDrag = (event, guidesToDrag) => { event.preventDefault(); event.stopPropagation(); dragging = { guides: Array.isArray(guidesToDrag) ? guidesToDrag : [guidesToDrag] }; const target = Array.isArray(guidesToDrag) ? guidesToDrag[0].el : guidesToDrag.el; (event.currentTarget || target).setPointerCapture(event.pointerId); };
  const move = event => {
    if (!active) return;
    let cursorX = Math.round(event.clientX + scrollX), cursorY = Math.round(event.clientY + scrollY);
    if (dragging && event.shiftKey) for (const guide of dragging.guides) {
      if (guide.axis === "h") cursorY = Math.round((event.clientY + scrollY) / 10) * 10;
      else cursorX = Math.round((event.clientX + scrollX) / 10) * 10;
    }
    readout.textContent = `x ${cursorX} · y ${cursorY}`;
    if (!dragging) return;
    const positions = dragging.guides.map(guide => {
      const rawPosition = guide.axis === "h" ? event.clientY + scrollY : event.clientX + scrollX;
      const position = event.shiftKey ? Math.round(rawPosition / 10) * 10 : rawPosition;
      guide.position = Math.max(0, position); renderGuide(guide); return `${guide.axis === "h" ? "Y" : "X"} ${Math.round(guide.position)} px`;
    });
    let tag = shadow.querySelector(".tag"); if (!tag) { tag = document.createElement("div"); tag.className = "tag"; shadow.append(tag); }
    tag.textContent = positions.join(" · "); tag.style.left = `${event.clientX + 10}px`; tag.style.top = `${event.clientY + 10}px`;
  };
  const finish = event => {
    if (!dragging) return;
    for (const guide of dragging.guides) {
      if ((guide.axis === "h" && event.clientY <= RULER_TOP) || (guide.axis === "v" && event.clientX <= RULER_LEFT)) { guide.el.remove(); guides = guides.filter(item => item !== guide); }
      else if (guides.some(item => item !== guide && item.axis === guide.axis && Math.round(item.position) === Math.round(guide.position))) { guide.el.remove(); guides = guides.filter(item => item !== guide); }
    }
    dragging = null; shadow.querySelector(".tag")?.remove(); save();
  };
  const rulerDown = (axis, event) => { if (!active) return; event.preventDefault(); const position = axis === "h" ? event.clientY + scrollY : event.clientX + scrollX; makeGuide({ axis, position }); const guide = guides.at(-1); beginDrag(event, guide); };
  top.addEventListener("pointerdown", event => rulerDown("h", event)); left.addEventListener("pointerdown", event => rulerDown("v", event));
  corner.addEventListener("pointerdown", event => {
    if (!active) return;
    const horizontal = { axis: "h", position: event.clientY + scrollY };
    const vertical = { axis: "v", position: event.clientX + scrollX };
    makeGuide(horizontal); const h = guides.at(-1); makeGuide(vertical); const v = guides.at(-1);
    beginDrag(event, [h, v]);
  });
  shadow.addEventListener("pointermove", move); shadow.addEventListener("pointerup", finish); shadow.addEventListener("pointercancel", finish);
  window.addEventListener("scroll", paint, { passive: true }); window.addEventListener("resize", paint);
  window.addEventListener("pointermove", move); window.addEventListener("pointerup", finish);
  chrome.runtime.onMessage.addListener(message => {
    if (message.type === "toggle") { active = !active; chrome.storage.local.set({ overlayEnabled: active }); if (active) chrome.storage.local.get(storageKey(), restoreGuides); else paint(); }
    if (message.type === "toggle-guides") { visibleGuides = !visibleGuides; paint(); }
    if (message.type === "clear-guides") { guides.forEach(guide => guide.el.remove()); guides = []; save(); }
    if (message.type === "set-color") { color = message.color; guides.forEach(renderGuide); }
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
  window.__guidesOverlay = true;
  chrome.storage.local.get(["overlayEnabled", "separate", "guideColor"], result => {
    active = result.overlayEnabled === true; separate = result.separate === true; color = result.guideColor || color;
    chrome.storage.local.get(storageKey(), restoreGuides);
  });
})();
