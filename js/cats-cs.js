// Run "CATS" detection code just on the dedicated page
// cez execute script
(function() {
    var shouldEnableCats = localStorage.getItem("project-cats");
    console.log("should enable? ", shouldEnableCats);

    if (shouldEnableCats) {
        chrome.runtime.sendMessage({ command: "allowprojectcats" });
    } else {
        chrome.runtime.sendMessage({ command: "disallowprojectcats" });
    }
})();