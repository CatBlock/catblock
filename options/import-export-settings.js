"use strict";

function backupData() {

    function downloadFile(filename, content) {
        let element = document.createElement("a");
        element.style.display = "none";

        element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(content));
        element.setAttribute("download", filename);

        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);
    }

    BGcall("get_settings", function(settings) {
        BGcall("get_subscribed_filter_lists", function(subscribedLists) {

            let data = {};

            data.settings = settings;
            data.filterLists = subscribedLists;
            data.customFilters = storage_get("custom_filters");
            data.disabledFilters = storage_get("exclude_filters");
            data.channels = storage_get("channels");
            data.blockageStats = storage_get("blockageStats");
            data.timeStamp = Date.now();

            let date = new Date(data.timeStamp).toISOString().slice(0, -5).replace(/-/g, "_").replace("T", "-");

            data = JSON.stringify(data, undefined, 2);

            downloadFile("catblock-backup-" + date + ".txt", data);
        });
    });
}

function restoreData() {

    document.getElementById("fileinput").addEventListener("change", function(event) {
        let reader = new FileReader();
        let file = document.getElementById("fileinput").files[0];

        reader.onload = function(event) {
            let text = JSON.parse(reader.result);
            console.log("Text: ", text);

            // Retrieve and save settings
            Object.keys(text.settings).forEach(function(item) {
                console.log(item);
                BGcall("set_setting", item, text.settings[item]);
            });

            // Subscribe/unsubscribe to the filter lists
            Object.keys(text.filterLists).forEach(function(item) {

            });

            // Custom filters



            // Disabled filters



            // CatBlock channels



            // Blockage stats
        }

        reader.readAsText(file);
    }, false);
}

function resetExtension() {

}

$(document).ready(function() {
    $("#backup").click(function() {
        backupData();
    });
    restoreData();
});