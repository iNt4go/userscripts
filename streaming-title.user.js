// ==UserScript==
// @name         Streaming Site Window Title
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Changes window title for streaming sites to enable Hyprland windowrules
// @author       You
// @match        *://*.youtube.com/*
// @match        *://plex.intago.me/*
// @match        *://*.hbomax.com/*
// @match        *://*.hbo.com/*
// @match        *://*.primevideo.com/*
// @match        *://*.amazon.com/gift-cards/*
// @match        *://*.disneyplus.com/*
// @match        *://*.netflix.com/*
// @match        *://*.twitch.tv/*
// @match        *://*.peacocktv.com/*
// @match        *://peacocktv.com/*
// @match        *://*.hulu.com/*
// @match        *://hulu.com/*
// @match        *://*.crunchyroll.com/*
// @match        *://*.paramountplus.com/*
// @match        *://*.sankakucomplex.com/*
// @match        *://*.nhentai.net/*
// @match        *://*.romm.intago.me/*

// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const STREAM_SUFFIX = ' [Stream]';

    function updateTitle() {
        if (!document.title.endsWith(STREAM_SUFFIX)) {
            document.title = document.title + STREAM_SUFFIX;
        }
    }

    const observer = new MutationObserver(updateTitle);
    observer.observe(document.documentElement, { childList: true, subtree: true });

    window.addEventListener('load', updateTitle);
})();
