"""
Merges i18n files from ../_locales/ and ../catblock/_locales

Author: Kieran Peckett
License: GNU GPLv3
"""

import json # Provides JSON-related functions
import os # Provides file-system functions

os.chdir("..") # Move CWD to root of repo

locales = os.listdir(r"catblock/_locales") # Load a list of all locales in the CatBlock locales folder.
for locale in locales: # "locale" below is the locale selected for this loop
	print "Merging i18n file for locale: " + locale
	with open("_locales/" + locale + "/messages.json", "rU") as ab_read: # Opens the AdBlock i18n file in a secure manner for read-only
		with open("catblock/_locales/" + locale + "/messages.json", "rU") as cb_file: # Opens the CatBlock i18n file in a secure manner
			ab_messages = json.load(ab_read) # Creates a dict of all messages in the AdBlock file
			cb_messages = json.load(cb_file) # Creates a dict of all messgaes in the CatBlock file
			ab_messages.update(cb_messages) # Updates the AdBlock strings with the CatBlock ones
			# Closes CatBlock messages file
		# Closes AdBlock messages file
	with open("_locales/" + locale + "/messages.json", "w") as ab_write: # Open the AdBlock i18n file as write-only (will overwite data!)
		ab_write.write(json.dumps(ab_messages, sort_keys=True, indent=2, separators=(',', ':'))) # Writes the JSON data to the AdBlock file in an easy-to-read format
		# Closes AdBlock messages file
	print "Merged i18n file for locale: %s" % locale

# Done!
