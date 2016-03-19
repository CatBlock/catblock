#!/usr/bin/python
"""
Prepare a Firefox release version

Author: Tomas Taro
License: GNU GPLv3
"""

import json # Provides JSON-related functions
import os # Provides file-system functions

os.chdir("..") # Move CWD to root of repo

# Keys, which should NOT be deleted
used = ["name", "version", "description", "content_scripts", "permissions", "manifest_version",
        "web_accessible_resources", "background", "browser_action", "default_locale", "icons"]

# Set, which is mandatory in Firefox
FF = {
    "gecko": {
        "id": "catblock@mozilla.org",
        "strict_min_version": "46"
    }
}

print "Preparing CatBlock for Firefox release..."
with open("manifest.json", "rU") as chrome_manifest: # Opens the AdBlock i18n file in a secure manner for read-only
    with open("ff_manifest.json", "w") as ff_manifest:
        keys = json.load(chrome_manifest) # Creates a dict of all messages in the AdBlock file
        for key, value in keys.items():
            if key not in used:
                print "Deleting key: %s" % key
                del keys[key]
        keys.update({ "applications": FF }) # Add FF specific key
        ff_manifest.write(json.dumps(keys, sort_keys=True, indent=2, separators=(',', ':')))
        print "CatBlock for Firefox has been built!"
