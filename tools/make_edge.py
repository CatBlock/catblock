 #!/usr/bin/python

"""
Prepare an Edge release versions of CatBlock

Author: Tomas Taro
License: GNU GPLv3
"""

import json # Provides JSON-related functions
import os # Provides file-system functions
import shutil # Provides folders functions

# Save CWD for later use
origcwd = os.getcwd()

# Copy the content of the original folder into "/catblock_edge/catblock"
if os.path.exists(os.getcwd() + "/catblock_edge"): # If /catblock_edge folder doesn't exist, create it
    shutil.rmtree(os.getcwd() + "/catblock_edge")

shutil.copytree(origcwd, os.getcwd() + "/catblock_edge/catblock", ignore=shutil.ignore_patterns(".git*"))

# Copy instructions file and setup file into "/catblock_edge" folder
shutil.move(os.getcwd() + "/catblock_edge/catblock/tools/instructions.txt", os.getcwd() + "/catblock_edge/")
shutil.move(os.getcwd() + "/catblock_edge/catblock/tools/Setup.cmd", os.getcwd() + "/catblock_edge/")

# Move to the top of the repo
os.chdir("..")

# Make a .zip file
shutil.make_archive("catblock-edge", "zip", os.getcwd() + "/catblock")

print "CatBlock for Edge has been built!"