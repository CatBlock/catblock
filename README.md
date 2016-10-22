CatBlock
========
[![Build Status](https://travis-ci.org/CatBlock/catblock.svg?branch=master)](https://travis-ci.org/CatBlock/catblock)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/cc8d000f77bb427caa8b0293d9b5d225)](https://www.codacy.com/app/tomastaro/catblock?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=CatBlock/catblock&amp;utm_campaign=Badge_Grade)
[![GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://github.com/CatBlock/catblock/blob/master/LICENSE.txt)

CatBlock (previously known as "AdBlock with CatBlock") is like an ad blocking extension, but instead of blocking ads it shows you pictures of cats by default (configurable).

You can also disable replacing ads by cats, so CatBlock can work as a standard ad blocking extension (useful for when you're doing presentations anywhere!)

This project aims at maintaining and improving the original [CatBlock](http://blog.getadblock.com/2012/04/catblock-lives-on.html) project by Michael Gundlach, the creator of [AdBlock](https://getadblock.com) and CatBlock.

If you want to keep an eye on (or even contribute to) the behind-the-scenes stuff, check out our [Trello Board](https://trello.com/catblock).

## Installation:
Available in [Chrome Web Store](https://chrome.google.com/webstore/detail/catblock/mdcgnhlfpnbeieiiccmebgkfdebafodo),
[Opera Extensions Store](https://addons.opera.com/sk/extensions/details/adblock-with-catblock/?display=en) and [Firefox Addons Store](https://addons.mozilla.org/en/firefox/addon/adblock-with-catblock/).
Right now, CatBlock is not available in the [Safari Extensions Store](https://safari-extensions.apple.com), or in the Windows Store (for Edge insiders). Instead, you must sideload the extension: [Edge instructions](https://github.com/CatBlock/catblock/wiki/Building-the-extension#in-microsoft-edge).

## Tools used for testing:
We use many different services to help keep CatBlock working! We use [Travis](http://travis-ci.org) to build new versions automatically for us. We're looking into a way of making a "nightly" version of CatBlock, with bleeding-edge (probably broken) code for testing.

We also have Travis connected to [BrowserStack](http://browserstack.com), to run a few automated tests for us. If "builds:passing" shows at the top of this README, then it's probably working fine, otherwise the current version of the code might not work so well.

## Compatibility:
Chrome: 49+
Opera: 35+
Safari: 9+
Firefox: 48+
Edge: 38.14342+

## Live chat:
[![Slack](http://catblock-slackin.herokuapp.com/badge.svg)](http://catblock-slackin.herokuapp.com)

We use Slack a lot - make an account at <http://catblock-slackin.herokuapp.com> and log in at <https://catblock.slack.com>. You can ask questions there (the main contributors are all in Europe, so anyone in Australia should expect a bit of a wait).

If you want to contribute any improvements, please go ahead and send us a pull request from a fork of this repo!

## Developers

0. Fork this repository.
1. Switch to your working directory.
2. Clone the development repository.

### In Chrome

3. Go to the Chrome menu > **Tools** > **Extensions**.
4. Check **Developer mode** then press **Load unpacked extension...** .
5. Find your working directory & select it.
6. To test after you make a change, be sure to click on **Reload** button on **chrome://extensions** page.
7. Push your changes.
8. Send us pull request!

### In Safari

3. First, you need to obtain a Safari Developer Certificate from [Apple](https://developer.apple.com/programs/safari/)
4. Go to **Develop** > **Show Extension Builder**.
5. Click **+** then select **Add Extension...** .
6. Find your working directory & select it.
7. Click **Install**.
8. To test after you make a change, be sure to click on **Reload** button in Extension Builder.
9. Push your changes.
10. Send us pull request!

### In Opera

3. Go to **about://extensions**.
4. Press **Developer Mode** then press **Load Unpacked Extension...** .
5. Find your working directory & select it.
6. To test after you make a change, be sure to click on **Reload** button on **about://extensions** page.
7. Push your changes.
8. Send us pull request!

If we see that you are a dedicated contributor, we may provide you with contributor permissions.
The people to contact for this project are @kpeckett and @tomasko126
