(() => {
  if (window.__guidesOverlay) return;

  const host = document.createElement("div");
  host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none";
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    *{box-sizing:border-box} .ruler{position:fixed;background:#171a20;color:#f2f5f7;pointer-events:auto;box-shadow:0 1px 5px #0008;font:10px/1.2 Arial,sans-serif;user-select:none;touch-action:none}
    #top{left:18px;right:0;top:0;height:20px;border-bottom:1px solid #ffffff45;background-image:repeating-linear-gradient(90deg,transparent 0 9px,#aeb8c4 9px 10px,transparent 10px 49px),repeating-linear-gradient(90deg,transparent 0 49px,#edf2f7 49px 50px,transparent 50px 99px)}
    #left{top:20px;bottom:0;left:0;width:18px;border-right:1px solid #ffffff45;background-image:repeating-linear-gradient(180deg,transparent 0 9px,#aeb8c4 9px 10px,transparent 10px 49px),repeating-linear-gradient(180deg,transparent 0 49px,#edf2f7 49px 50px,transparent 50px 99px)}
    .label{position:absolute;white-space:nowrap;background:#171a20;padding:1px 2px}.h-label{top:1px}.v-label{left:1px;writing-mode:vertical-rl}.readout{position:fixed;z-index:4;top:22px;left:22px;background:#171a20;color:white;padding:4px 6px;border-radius:2px;font:11px Arial;pointer-events:none}
    .guide{position:absolute;pointer-events:auto;touch-action:none}.horizontal{left:18px;right:0;height:7px;transform:translateY(-50%);cursor:ns-resize}.vertical{top:20px;bottom:0;width:7px;transform:translateX(-50%);cursor:ew-resize}.line{position:absolute;background:var(--guide-color,#00e5ff);box-shadow:0 0 1px #000;pointer-events:none}.horizontal .line{height:1px;left:0;right:0;top:3px}.vertical .line{width:1px;top:0;bottom:0;left:3px}.tag{position:fixed;background:#10161b;color:#fff;padding:3px 5px;font:11px Arial;pointer-events:none;white-space:nowrap;z-index:5}.hidden{display:none!important}`;
  shadow.append(style);
  const top = document.createElement("div"); top.id = "top"; top.className = "ruler";
  const left = document.createElement("div"); left.id = "left"; left.className = "ruler";
  const readout = document.createElement("div"); readout.className = "readout"; readout.textContent = "x 0 · y 0";
  shadow.append(top, left, readout);
  document.documentElement.append(host);

  let active = false, visibleGuides = true, color = "#00e5ff", guides = [], dragging = null;
  const key = `guides:${location.origin}${location.pathname}${location.search}`;
  const makeGuide = ({ axis, position }) => {
    const el = document.createElement("div");
    el.className = `guide ${axis === "h" ? "horizontal" : "vertical"}`;
    el.style.setProperty("--guide-color", color);
    const line = document.createElement("span"); line.className = "line"; el.append(line);
    shadow.append(el);
    const guide = { axis, position, el };
    guides.push(guide); renderGuide(guide);
    el.addEventListener("pointerdown", event => beginDrag(event, guide));
    el.addEventListener("dblclick", event => { event.stopPropagation(); const value = prompt("Guide position (CSS px)", String(Math.round(guide.position))); if (value !== null && Number.isFinite(Number(value))) { guide.position = Math.max(0, Number(value)); renderGuide(guide); save(); } });
  };
  const renderGuide = guide => { guide.el.style.left = guide.axis === "v" ? `${guide.position - scrollX}px` : ""; guide.el.style.top = guide.axis === "h" ? `${guide.position - scrollY}px` : ""; guide.el.classList.toggle("hidden", !visibleGuides); };
  const save = () => chrome.storage.local.set({ [key]: guides.map(({ axis, position }) => ({ axis, position })) });
  const paint = () => {
    top.replaceChildren(); left.replaceChildren();
    top.style.backgroundPosition = `${-(scrollX % 100)}px 0`;
    left.style.backgroundPosition = `0 ${-(scrollY % 100)}px`;
    top.classList.toggle("hidden", !active); left.classList.toggle("hidden", !active); readout.classList.toggle("hidden", !active);
    for (let x = Math.floor(scrollX / 100) * 100; x < scrollX + innerWidth; x += 100) { const label = document.createElement("span"); label.className = "label h-label"; label.style.left = `${x - scrollX + 2}px`; label.textContent = x; top.append(label); }
    for (let y = Math.floor(scrollY / 100) * 100; y < scrollY + innerHeight; y += 100) { const label = document.createElement("span"); label.className = "label v-label"; label.style.top = `${y - scrollY + 2}px`; label.textContent = y; left.append(label); }
    guides.forEach(renderGuide);
  };
  const beginDrag = (event, guide) => { event.preventDefault(); event.stopPropagation(); dragging = { guide, pointer: event.pointerId }; guide.el.setPointerCapture(event.pointerId); };
  const move = event => {
    if (!active) return;
    readout.textContent = `x ${Math.round(event.clientX + scrollX)} · y ${Math.round(event.clientY + scrollY)}`;
    if (!dragging) return;
    const pos = dragging.guide.axis === "h" ? event.clientY + scrollY : event.clientX + scrollX;
    dragging.guide.position = Math.max(0, pos); renderGuide(dragging.guide);
    let tag = shadow.querySelector(".tag"); if (!tag) { tag = document.createElement("div"); tag.className = "tag"; shadow.append(tag); }
    tag.textContent = `${Math.round(pos)} px`; tag.style.left = `${event.clientX + 10}px`; tag.style.top = `${event.clientY + 10}px`;
  };
  const finish = event => {
    if (!dragging) return;
    const guide = dragging.guide;
    if ((guide.axis === "h" && event.clientY <= 20) || (guide.axis === "v" && event.clientX <= 18)) { guide.el.remove(); guides = guides.filter(item => item !== guide); }
    dragging = null; shadow.querySelector(".tag")?.remove(); save();
  };
  const rulerDown = (axis, event) => { if (!active) return; event.preventDefault(); const position = axis === "h" ? event.clientY + scrollY : event.clientX + scrollX; makeGuide({ axis, position }); const guide = guides.at(-1); beginDrag(event, guide); };
  top.addEventListener("pointerdown", event => rulerDown("h", event)); left.addEventListener("pointerdown", event => rulerDown("v", event));
  shadow.addEventListener("pointermove", move); shadow.addEventListener("pointerup", finish); shadow.addEventListener("pointercancel", finish);
  window.addEventListener("scroll", paint, { passive: true }); window.addEventListener("resize", paint);
  window.addEventListener("pointermove", move); window.addEventListener("pointerup", finish);
  chrome.runtime.onMessage.addListener(message => {
    if (message.type === "toggle") { active = !active; if (active) chrome.storage.local.get(key, result => { guides.forEach(g => g.el.remove()); guides = []; (result[key] || []).forEach(makeGuide); paint(); }); else paint(); }
    if (message.type === "toggle-guides") { visibleGuides = !visibleGuides; paint(); }
    if (message.type === "clear-guides") { guides.forEach(guide => guide.el.remove()); guides = []; save(); }
    if (message.type === "set-color") { color = message.color; guides.forEach(guide => guide.el.style.setProperty("--guide-color", color)); }
  });
  window.__guidesOverlay = true;
  paint();
})();
