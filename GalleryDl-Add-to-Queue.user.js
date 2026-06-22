// ==UserScript==
// @name         Gallery-dl Add to Queue
// @namespace    http://tampermonkey.net/
// @downloadURL  https://github.com/iNt4go/userscripts/raw/refs/heads/main/GalleryDl-Add-to-Queue.user.js
// @version      2026-06-22-1
// @description  Add the current page URL to a gallery-dl staging queue via Tampermonkey context menu.
// @author       iNtago
// @match        *://*.youtube.com/*
// @match        *://youtube.com/*
// @match        *://*.bunkr.cr/*
// @match        *://bunkr.cr/*
// @grant        GM_download
// @grant        GM_notification
// @run-at       context-menu
// ==/UserScript==

(function () {
    'use strict';

    const DOWNLOAD_SUBDIR = '-[Gallery-dl]/.gdlq';

    function sanitize(value) {
        return value
            .replace(/[^a-zA-Z0-9._-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 80) || 'page';
    }

    function buildFilename(url) {
        const now = new Date();
        const stamp = now.getFullYear().toString()
            + String(now.getMonth() + 1).padStart(2, '0')
            + String(now.getDate()).padStart(2, '0')
            + '-'
            + String(now.getHours()).padStart(2, '0')
            + String(now.getMinutes()).padStart(2, '0')
            + String(now.getSeconds()).padStart(2, '0')
            + '-'
            + String(now.getMilliseconds()).padStart(3, '0');

        const host = sanitize(url.hostname.replace(/^www\./, ''));
        const pathBits = url.pathname.split('/').filter(Boolean).slice(0, 3).map(sanitize).filter(Boolean);
        const pathPart = pathBits.join('__') || 'root';
        const randomPart = Math.random().toString(36).slice(2, 8);

        return `${DOWNLOAD_SUBDIR}/${stamp}__${host}__${pathPart}__${randomPart}.txt`;
    }

    function queueCurrentUrl() {
        const currentUrl = new URL(location.href);
        const payload = `${currentUrl.href}\n`;
        const filename = buildFilename(currentUrl);
        const blob = new Blob([payload], { type: 'text/plain;charset=utf-8' });
        const objectUrl = URL.createObjectURL(blob);

        GM_download({
            url: objectUrl,
            name: filename,
            saveAs: false,
            onload: () => {
                URL.revokeObjectURL(objectUrl);
                if (typeof GM_notification === 'function') {
                    GM_notification({
                        title: 'Gallery-dl queue',
                        text: `Queued: ${currentUrl.href}`,
                        timeout: 2500,
                    });
                }
            },
            onerror: (error) => {
                URL.revokeObjectURL(objectUrl);
                console.error('Gallery-dl Add to Queue: download failed', error);
                if (typeof GM_notification === 'function') {
                    GM_notification({
                        title: 'Gallery-dl queue',
                        text: 'Failed to queue URL. Check Tampermonkey download settings.',
                        timeout: 4000,
                    });
                }
            },
            ontimeout: () => {
                URL.revokeObjectURL(objectUrl);
                console.error('Gallery-dl Add to Queue: download timed out');
            },
        });
    }

    queueCurrentUrl();
})();
