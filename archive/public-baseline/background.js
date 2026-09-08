chrome.action.onClicked.addListener((tab) => {
  executeContentScript(tab);
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "activate_extension") {
    executeContentScript(tab);
  }
});

function executeContentScript(tab) {
  chrome.scripting.executeScript({
    target: {tabId: tab.id},
    files: ['contentScript.js']
  });
}
