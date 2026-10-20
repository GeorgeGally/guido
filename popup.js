const send = async message => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return;
  try { await chrome.tabs.sendMessage(tab.id, message); }
  catch { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }); await chrome.tabs.sendMessage(tab.id, message); }
};
document.querySelector("#toggle").addEventListener("click", () => send({ type: "toggle" }));
document.querySelector("#clear").addEventListener("click", () => send({ type: "clear-guides" }));
chrome.storage.local.get(["separate", "guideColor"], result => {
  document.querySelector("#separate").checked = result.separate === true;
  document.querySelector("#color").value = result.guideColor || "#00e5ff";
});
document.querySelector("#color").addEventListener("input", event => {
  chrome.storage.local.set({ guideColor: event.target.value });
  send({ type: "set-color", color: event.target.value });
});
document.querySelector("#separate").addEventListener("change", event => {
  chrome.storage.local.set({ separate: event.target.checked });
  send({ type: "set-separate", separate: event.target.checked });
});
