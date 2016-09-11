// Run "CATS" detection code just on the dedicated page
// cez execute script
(function() {
    var key = "project-cats";
    var shouldEnableCats = localStorage.getItem(key);

    if (shouldEnableCats) {
        chrome.runtime.sendMessage({ command: "enableprojectcats" });
    } else {
        chrome.runtime.sendMessage({ command: "disableprojectcats" });
    }

    // Remove the key from a local storage
    localStorage.removeItem(key);
})();