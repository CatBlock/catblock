// Run "CATS" detection code just on the dedicated page
// cez execute script
(function() {
    var shouldEnableCats = localStorage.getItem("project-cats");

    if (shouldEnableCats) {
        chrome.runtime.sendMessage({ command: "enableprojectcats" });
    } else {
        chrome.runtime.sendMessage({ command: "disableprojectcats" });
    }
})();