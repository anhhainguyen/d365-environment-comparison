// Message handler: popup requests a full-page tab via the OPEN_FULL_TAB message.
// (chrome.action.onClicked is not used because default_popup is set in the manifest.)
chrome.runtime.onMessage.addListener(function(msg) {
  if (msg && msg.type === 'OPEN_FULL_TAB') {
    var url = chrome.runtime.getURL('popup.html') + '?fullpage=1';
    chrome.tabs.create({ url: url });
  }
});
