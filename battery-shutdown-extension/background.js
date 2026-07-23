chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.shutdown === true) {
    chrome.power.shutdown();
  }
});
