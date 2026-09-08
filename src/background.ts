chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) return;
  const url = chrome.runtime.getURL("popup.html") + "?tab=" + tab.id;
  void chrome.windows.create({ url, type: "popup", width: 1120, height: 800 });
});
