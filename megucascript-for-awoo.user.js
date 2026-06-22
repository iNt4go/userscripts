// ==UserScript==
// @name        megucascript for awoo
// @namespace   megucasoft
// @description Awoo extensions: commands, secret posting, music player, post formatting, post filters
// @include     https://awoo.cf/*
// @version     3.5.81
// @author      medukasthegucas & a random anon
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_deleteValue
// @grant       GM_listValues
// @grant       GM_addValueChangeListener
// @grant       GM_openInTab
// @grant       GM_xmlhttpRequest
// @grant       GM.getValue
// @grant       GM.setValue
// @grant       GM.deleteValue
// @grant       GM.listValues
// @grant       GM.openInTab
// @grant       GM.xmlHttpRequest
// @connect     waifuvault.moe
// @connect     uploads.waifuvault.moe
// ==/UserScript==

const defaultFiletypes = ".jpg .png .gif";
var chuuCount = 0;

const onOffOptions = [["pyuOption", "Pyu Coloring~"],
                      ["decideOption", "Decision Coloring"],
                      ["dumbPosters", "Dumb xposters"],
                      ["dumbblanc", "dumb blancposters, not cute"],
                      ["sharesOption", "Shares Formatting"],
                      ["screamingPosters", "Vibrate screaming posts"],

                      ["secretBorder", "Post Border"],
                      ["sekritPosting", "Sekrit Posting"],
                      ["imgsekritPosting", "Image Sekrit Posting<br><br>(Check off the following option if you have drag and drop problems)"],
                      ["enablemegucaplayer", "Enable music player"],
                      ["megucaplayerOption", "Show music player<br>"],
                      ["annoyingFormatting", "Annoying formatting button"],
                      ["mathOption", "Enables math parsing"],
                      ["chuuOption", "Enables receivement of chuu~s"],
                      ["cancelposters", "Dumb cancelposters"],
                      ["filterPosts", "Filter posts"],
                      ["hideMD5Posts", "Hide Filtered MD5 Posts"],
                      ["hidePhashPosts", "Hide Filtered pHash Posts"],
                      ["preSubmitOption", "Enables pre-submit post processing (necessary for some functions)"]];

const offByDefaultOptions = new Set(["hideMD5Posts", "hidePhashPosts", "secretBorder"]);

const themeEl = document.getElementById("theme");
const themes = themeEl ? Array(themeEl.options.length).fill().map((val, idx) => themeEl.options[idx].value) : [];

const tabConts = document.getElementsByClassName("tab-cont");
const nonScriptOptions = (tabConts && tabConts[1])
    ? Array.from(tabConts[1].getElementsByTagName('label'), lab => lab.getAttribute('for')).filter(x => x)
    : [];

var keybinds = [["spoilerShortcut", "Ctrl+S", "**"],
                ["boldShortcut", "Ctrl+B", "@@"],
                ["italicsShortcut", "Ctrl+I", "~~"],
                ["programmingShortcut", "Ctrl+P", "``"],
                ["redtextShortcut", "Ctrl+R", "^r"],
                ["bluetextShortcut", "Alt+B", "^b"]];

var currentlyEnabledOptions = new Set();
var flashingDuration = 60;
var vibrationDuration = 4;
var setFunc, getFunc;
var customFilterText = "#Custom filters (lines starting with # are ignored)\n\
#text: is assumed by default if you don't specify otherwise\n\
#text:^[Aa]+$\n\
#name:[^(^Anonymous$)]\n\
#id:Fautatkal\n\
#flag:Sweden\n\
#filename:image\\.png\n\
#md5:<image/video file hash> -- hides only the media; added via the post menu's Filter MD5 entry\n\
#phash:<16-hex-char perceptual hash> -- matches similar images even after re-encoding; added via the post menu's Filter pHash entry\n\
#subject:<word/regex> -- hides matching threads on catalog/board/all listings; plain words match whole-word and case-insensitively (subject:gen matches Gen Thread but not generation); thread is still viewable by URL\n";
var customFilters = [];
const filterTypes = new Map([["text", ".post-container"],
                             ["name", ".name.spaced > span:nth-child(1)"],
                             ["id", ".name.spaced > span:nth-child(2)"],
                             ["flag", ".flag"],
                             ["filename", "figcaption > a:not(.image-toggle)"]]);

function showToast(message, durationMs, asHtml) {
    durationMs = durationMs || 3500;
    var toast = document.createElement("div");
    toast.className = "mgc-toast";
    if (asHtml) toast.innerHTML = message;
    else toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(function () { toast.style.opacity = "1"; toast.style.transform = "translateY(0)"; });
    setTimeout(function () {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-10px)";
        setTimeout(function () { toast.remove(); }, 400);
    }, durationMs);
}

function hackLatsOptions() {
    var options = document.getElementById("options");
    if (!options) return;
    var tab_butts = options.getElementsByClassName("tab-butts")[0];
    var tab_cont = options.getElementsByClassName("tab-cont")[0];
    if (!tab_butts || !tab_cont) return;

    var shortcutsDiv = tab_cont.getElementsByTagName("div")[4];
    if (shortcutsDiv) {
        shortcutsDiv.insertAdjacentHTML('beforeend', "<br><input name=\"spoilerShortcut\" id=\"spoilerShortcut\" title=\"Shortcut for spoilers\" style=\"width:150px\" class=\"shortcut\"><label for=\"spoilerShortcut\" title=\"Shortcut for spoilers\">Spoiler tags</label><br>");
        shortcutsDiv.insertAdjacentHTML('beforeend', "<input name=\"boldShortcut\" id=\"boldShortcut\" title=\"Shortcut for bold\" style=\"width:150px\" class=\"shortcut\"><label for=\"boldShortcut\" title=\"Shortcut for bold\">Bold tags</label><br>");
        shortcutsDiv.insertAdjacentHTML('beforeend', "<input name=\"italicsShortcut\" id=\"italicsShortcut\" title=\"Shortcut for italics\" style=\"width:150px\" class=\"shortcut\"><label for=\"italicsShortcut\" title=\"Shortcut for italics\">Italic tags</label><br>");
        shortcutsDiv.insertAdjacentHTML('beforeend', "<input name=\"programmingShortcut\" id=\"programmingShortcut\" title=\"Shortcut for code tags\" style=\"width:150px\" class=\"shortcut\"><label for=\"programmingShortcut\" title=\"Shortcut for code tags\">Programming tags</label><br>");
        shortcutsDiv.insertAdjacentHTML('beforeend', "<input name=\"redtextShortcut\" id=\"redtextShortcut\" title=\"Shortcut for red text\" style=\"width:150px\" class=\"shortcut\"><label for=\"redtextShortcut\" title=\"Shortcut for red text\">Red text tags</label><br>");
        shortcutsDiv.insertAdjacentHTML('beforeend', "<input name=\"bluetextShortcut\" id=\"bluetextShortcut\" title=\"Shortcut for blue text\" style=\"width:150px\" class=\"shortcut\"><label for=\"bluetextShortcut\" title=\"Shortcut for blue text\">Blue text tags</label><br>");
    }

    function pickNextTabId(start) {
        var used = new Set();
        Array.from(tab_butts.querySelectorAll('.tab-link')).forEach(function (a) {
            var v = a.getAttribute('data-id');
            if (v != null) used.add(v);
        });
        Array.from(tab_cont.children).forEach(function (d) {
            var v = d.getAttribute('data-id');
            if (v != null) used.add(v);
        });
        var n = start;
        while (used.has(String(n))) n++;
        used.add(String(n));
        return n;
    }
    var mainTabId = pickNextTabId(5);
    var sekritTabId = pickNextTabId(mainTabId + 1);

    var new_butt = "<a class=\"tab-link\" data-id=\"" + mainTabId + "\">Meguca Userscript</a>";
    var new_cont = "<div data-id=\"" + mainTabId + "\">";

    var MGC_MOVED_TO_ENCODE = new Set(["secretBorder", "sekritPosting", "imgsekritPosting"]);
    for (var i = 0; i < onOffOptions.length; i++) {
        var id = onOffOptions[i][0];
        var name = onOffOptions[i][1];
        if (MGC_MOVED_TO_ENCODE.has(id)) continue;
        new_cont += "<input type=\"checkbox\" name=" + id + " id=" + id + " class=\"mgc-opt-checkbox\"> <label for=" + id + ">" + name + "</label><br>";
    }

    new_cont += "<div class=\"mgc-below-presubmit\">";
    new_cont += "<input type=\"textbox\" name=flashing id=flashing> <label for=flashing>Flashing Duration</label><br>";
    new_cont += "<input type=\"textbox\" name=vibration id=vibration> <label for=vibration>Vibration Duration</label><br>";
    new_cont += "<span>Steal all files ending with </span><input type=\"textbox\" name=steal_filetypes id=steal_filetypes><button type=\"button\" id=\"stealButton\">Steal files</button><br>";
    new_cont += "<textarea rows=4 cols=60 id=customFilters style='font-size: 10pt;'></textarea><br>";
    new_cont += "<button type=\"button\" id=\"saveFilters\">Save filter changes</button>";
    new_cont += "</div>";
    new_cont += "<br>You have received <span id=\"chuu-counter\">" + chuuCount + "</span> chuu~'s";
    new_cont += "<br><a href=\"https://github.com/dasdgdafg/megukascript/blob/master/README.md\" target=\"_blank\">How do I use this?</a>";
    new_cont += "</div>";

    var new_sekrit_butt = "<a class=\"tab-link\" data-id=\"" + sekritTabId + "\">Encode</a>";

    var new_sekrit_cont = "<div data-id=\"" + sekritTabId + "\" style=\"position:relative;\">";

    new_sekrit_cont += "<div class=\"mgc-encode-right-options\" style=\"position:absolute;top:6px;right:8px;text-align:left;\">"
        + "<input type=\"checkbox\" name=\"secretBorder\" id=\"secretBorder\" class=\"mgc-opt-checkbox\"> <label for=\"secretBorder\">Post Border</label><br>"
        + "<div class=\"mgc-encode-right-options-bottom\">"
        +   "<input type=\"checkbox\" name=\"sekritPosting\" id=\"sekritPosting\" class=\"mgc-opt-checkbox\"> <label for=\"sekritPosting\">Sekrit Posting</label><br>"
        +   "<span class=\"mgc-img-sekrit-row\" style=\"position:relative;top:-1px;display:inline-block;\">"
        +     "<input type=\"checkbox\" name=\"imgsekritPosting\" id=\"imgsekritPosting\" class=\"mgc-opt-checkbox\"> <label for=\"imgsekritPosting\">Image Sekrit Posting</label>"
        +   "</span>"
        + "</div>"
        + "</div>";

    new_sekrit_cont += "<div style=\"margin-top:6px;\"><span style=\"font-weight:bold;position:relative;left:1.5px;\">Sekrit Encode</span><span id=\"secret-scan-progress\" style=\"font-size:11px;color:#888;margin-left:6px;\"></span></div>";
    new_sekrit_cont += "<div style=\"margin:4px 0;\"><textarea name=\"hidetext\" id=\"hidetext\" rows=\"1\" placeholder=\"Sekrit Encode Text\" style=\"resize:both;vertical-align:middle;width:165px;height:calc(1.6em + 5px);font-family:inherit;font-size:inherit;box-sizing:border-box;\"></textarea> <button type=\"button\" id=\"secretButton\">Convert &amp; Input</button></div>";
    new_sekrit_cont += "<span id=\"secret_image_wrap\" tabindex=\"0\" style=\"display:inline-block;\">";
    new_sekrit_cont += "<input name=\"secret_image\" id=\"secret_image\" type=\"file\">";
    new_sekrit_cont += "</span>";

    new_sekrit_cont += "<br><div style=\"margin-top:6px;position:relative;display:flex;align-items:center;gap:6px;flex-wrap:wrap;\">"
        + "<input type=\"checkbox\" id=\"jpeScanEnabled\" style=\"position:absolute;left:-20px;top:-1.5px;\">"
        + "<label for=\"jpeScanEnabled\" style=\"font-weight:bold;cursor:pointer;\">JPE</label>"
        + "<span id=\"jpe-scan-progress\" style=\"font-size:11px;color:#888;\"></span>"
        + "</div>";

    new_sekrit_cont += "<div id=\"jpe-wrap\" style=\"display:grid;grid-template-columns:165px max-content 1fr;grid-template-rows:auto auto auto;gap:4px 8px;margin:4px 0;align-items:center;justify-items:start;\">";

    new_sekrit_cont += "  <span id=\"jpe-hidden-box\" class=\"jpe-filebox\" tabindex=\"0\" style=\"grid-column:1;grid-row:1;\"><span class=\"jpe-filebox-label\">Hidden File</span><span class=\"jpe-filebox-name\">(none)</span><span class=\"jpe-filebox-clear\" title=\"Clear\" style=\"display:none;\">×</span><input type=\"file\" id=\"jpe-hidden-input\" style=\"display:none;\"></span>";
    new_sekrit_cont += "  <span id=\"jpe-expiry-label\" style=\"grid-column:2;grid-row:1;color:#ff7b7b;font-size:9px;line-height:1;align-self:center;\">Exp.7D</span>";
    new_sekrit_cont += "  <span id=\"jpe-base-box\" class=\"jpe-filebox\" tabindex=\"0\" style=\"grid-column:1;grid-row:2;\"><span class=\"jpe-filebox-label\">Base File</span><span class=\"jpe-filebox-name\">(none)</span><span class=\"jpe-filebox-clear\" title=\"Clear\" style=\"display:none;\">×</span><input type=\"file\" id=\"jpe-base-input\" accept=\"image/png,image/jpeg\" style=\"display:none;\"></span>";
    new_sekrit_cont += "  <button type=\"button\" id=\"jpe-embed-input\" style=\"grid-column:2;grid-row:2;position:relative;top:-1px;\">Embed &amp; Input</button>";
    new_sekrit_cont += "  <div id=\"jpe-status\" style=\"grid-column:3;grid-row:2;font-size:11px;min-height:14px;color:#888;word-break:break-all;align-self:center;\"></div>";
    new_sekrit_cont += "  <textarea id=\"jpe-text-input\" rows=\"1\" placeholder=\"JPE Text\" style=\"grid-column:1;grid-row:3;resize:both;width:165px;height:calc(1.6em + 5px);font-family:inherit;font-size:inherit;box-sizing:border-box;vertical-align:top;\"></textarea>";

    new_sekrit_cont += "</div>";

    tab_butts.insertAdjacentHTML('beforeend', new_butt + new_sekrit_butt);
    tab_cont.insertAdjacentHTML('beforeend', new_cont + new_sekrit_cont);

    for (i = 0; i < keybinds.length; i++) {
        var userSet = getFunc(keybinds[i][0], keybinds[i][1]);
        var el = document.getElementById(keybinds[i][0]);
        if (el) el.value = userSet;
        keybinds[i][1] = userSet;
    }

    for (i = 0; i < onOffOptions.length; i++) {
        id = onOffOptions[i][0];
        var optEl = document.getElementById(id);
        if (!optEl) continue;
        optEl.checked = currentlyEnabledOptions.has(id);
        optEl.onchange = function () {
            setFunc(this.id, this.checked ? "on" : "off");
            if (this.checked) currentlyEnabledOptions.add(this.id);
            else currentlyEnabledOptions.delete(this.id);
            if (this.id === "secretBorder") syncSecretBorderClass();
        };
    }

    var showPl = document.getElementById("megucaplayerOption");
    if (showPl) showPl.onclick = mgcPl_optionClicked;

    var enablePl = document.getElementById("enablemegucaplayer");
    if (enablePl) {
        var prevOnChange = enablePl.onchange;
        enablePl.onchange = function () {
            if (prevOnChange) prevOnChange.call(this);
            mgcPl_enableToggled(this.checked);
        };
    }

    var flashing = document.getElementById("flashing");
    if (flashing) {
        flashing.value = flashingDuration;
        flashing.onchange = function () {
            setFunc(this.id, (this.value > 60) ? 60 : this.value);
        };
    }

    var vibration = document.getElementById("vibration");
    if (vibration) {
        vibration.value = vibrationDuration;
        vibration.onchange = function () {
            setFunc(this.id, (this.value > 60) ? 60 : this.value);
        };
    }

    var hideTextEl = document.querySelector("#hidetext");
    if (hideTextEl) {

        hideTextEl.addEventListener("keydown", function (event) {
            if (event.key !== "Enter") return;
            if (event.shiftKey || event.ctrlKey) return;
            event.preventDefault();
            document.querySelector("#secretButton").click();
        });
        hideTextEl.addEventListener('paste', function (e) {
            var files = e.clipboardData.files;
            if (files.length == 1) {
                var secretImage = document.getElementById("secret_image");
                if (secretImage != undefined) {
                    secretImage.files = files;
                    secretImage.javascriptIsFuckingDumb = files[0];
                    e.stopPropagation();
                }
            }
        });
    }

    var stealEl = document.getElementById("steal_filetypes");
    if (stealEl) stealEl.value = defaultFiletypes;
    var stealBtn = document.getElementById("stealButton");
    if (stealBtn) stealBtn.onclick = function () { downloadAll(); };

    var secretBtn = document.getElementById("secretButton");
    if (secretBtn) secretBtn.onclick = secretButtonPressed;

    setupJpeBoxes();

    var pasteWrap = document.getElementById("secret_image_wrap");
    if (pasteWrap) {
        var lastPasteAt = 0;
        pasteWrap.addEventListener('paste', function (e) {
            var files = e.clipboardData && e.clipboardData.files;
            if (!files || files.length === 0) return;
            var secretImage = document.getElementById("secret_image");
            if (!secretImage) return;
            try {
                var dt = new DataTransfer();
                for (var i = 0; i < files.length; i++) dt.items.add(files[i]);
                secretImage.files = dt.files;
            } catch (err) {
                secretImage.files = files;
            }
            secretImage.javascriptIsFuckingDumb = files[0];
            lastPasteAt = Date.now();
            e.preventDefault();
            e.stopPropagation();
        });

        var secretImageEl = document.getElementById("secret_image");
        if (secretImageEl) {
            secretImageEl.addEventListener('click', function (e) {
                if (Date.now() - lastPasteAt < 1000) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }, true);
        }
    }

    var customFiltersEl = document.getElementById("customFilters");
    if (customFiltersEl) customFiltersEl.value = customFilterText;
    var saveFiltersBtn = document.getElementById("saveFilters");
    if (saveFiltersBtn) {
        saveFiltersBtn.onclick = function () {
            customFilterText = document.getElementById("customFilters").value;
            setFunc("customFilterText", customFilterText);
        };
    }

    for (i = 0; i < nonScriptOptions.length; i++) {
        id = nonScriptOptions[i];
        if (!id) continue;
        var nsEl = document.getElementById(id);
        if (!nsEl) continue;
        var stored = getFunc(id, nsEl.value);
        nsEl.value = stored;
        nsEl.onchange = function () { setFunc(this.id, this.value); };
    }
}

function insertCuteIntoCSS() {
    var css = document.createElement("style");
    css.type = "text/css";
    css.innerHTML =
        ".sekrit_text { color: #FFDC91; }" +

        ".mgc-image-secret { display: block; color: #FFDC91; word-break: break-word; margin-top: 5em; }" +

        "body.mgc-secret-border article:has(.sekrit_text), body.mgc-secret-border article:has(.jpe-text-embed), body.mgc-secret-border article.jpe-embed-live { outline: 1px solid #FFDC91; outline-offset: 0; border-radius: 4px; box-shadow: 0 0 6px rgba(255, 220, 145, 0.35); margin: 2px 0; }" +

        "body.mgc-secret-border article article:has(.sekrit_text), body.mgc-secret-border article article:has(.jpe-text-embed), body.mgc-secret-border article article.jpe-embed-live { outline: none; box-shadow: none; margin: 0; border-radius: 0; }" +

        ".jpe-filebox { display: inline-flex; align-items: center; padding: 2px 6px; border: 1px solid #444; border-radius: 3px; background: #2a2a2a; color: #ddd; cursor: pointer; user-select: none; outline: none; font-size: 11px; }" +
        ".jpe-filebox:focus { border-color: #7bff9b; }" +

        ".jpe-filebox.jpe-filebox-dragover { border-color: #7bff9b; background: rgba(123,255,155,0.08); }" +
        ".jpe-filebox-label { font-weight: bold; flex-shrink: 0; }" +
        ".jpe-filebox-name { color: #888; margin-left: 6px; flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }" +
        ".jpe-filebox-clear { margin-left: 6px; padding: 0 4px; font-weight: bold; color: #888; cursor: pointer; flex-shrink: 0; }" +
        ".jpe-filebox-clear:hover { color: #ff7b7b; }" +

        ".jpe-custom-urlinput { flex: 1 1 auto; min-width: 0; margin-left: 6px; background: transparent; border: none; outline: none; color: #ddd; font: inherit; padding: 0; }" +
        ".jpe-custom-urlinput::placeholder { color: #888; }" +
        ".jpe-custom-urlinput.jpe-custom-invalid { color: #ff7b7b; }" +

        ".jpe-filebox { width: 165px !important; max-width: 165px !important; white-space: nowrap; overflow: hidden; box-sizing: border-box; }" +
        "#jpe-text-input { box-sizing: border-box; }" +

        "#jpe-host-box { overflow: visible !important; }" +

        ".mgc-opt-checkbox { position: relative; top: 2px; }" +

        ".mgc-below-presubmit { position: relative; top: 0.5px; }" +

        ".mgc-encode-right-options { line-height: 1.4em; font-size: inherit; }" +

        ".mgc-encode-right-options-bottom { position: relative; top: -2.5px; }" +
        ".jpe-host-chevron { margin-left: 6px; font-size: 10px; color: #888; flex-shrink: 0; }" +
        ".jpe-host-dropdown:focus .jpe-host-chevron, .jpe-host-dropdown:hover .jpe-host-chevron { color: #ddd; }" +
        "#jpe-host-menu { position: absolute; top: 100%; left: 0; right: 0; margin-top: 2px; background: #1a1a1a; border: 1px solid #555; border-radius: 3px; z-index: 100; }" +
        ".jpe-host-option { padding: 4px 8px; color: #ddd; cursor: pointer; font-size: 11px; }" +
        ".jpe-host-option:hover, .jpe-host-option.jpe-host-option-active { background: #333; }" +
        ".jpe-host-option.jpe-host-option-selected::before { content: '\\2713  '; color: #7bff9b; }" +

        ".jpe-embed { float: left; margin: 7px 8px 0 0; line-height: 0; font-size: 0; }" +
        ".jpe-embed-item { display: block; }" +
        ".jpe-thumb { display: block; max-width: 150px; max-height: 150px; height: auto; width: auto; cursor: pointer; vertical-align: top; margin: 0; padding: 0; border: 0; }" +

        ".jpe-thumb.jpe-expanded { max-width: 90vw !important; max-height: 90vh !important; height: auto !important; width: auto !important; position: relative; z-index: 100; cursor: zoom-out; }" +
        ".jpe-embed.jpe-embed-expanded { float: none; margin: 4px 0; overflow: visible; }" +
        ".jpe-hover-preview { position: fixed; z-index: 100000; pointer-events: none; max-width: 80vw; max-height: 80vh; box-shadow: 0 4px 16px rgba(0,0,0,.5); }" +

        ".jpe-loading { display: flex; align-items: center; justify-content: center; border: 1px solid #666; color: #aaa; font-size: 12px; box-sizing: border-box; background: rgba(0,0,0,0.15); }" +
        ".jpe-loading.jpe-unavailable { color: #ff7b7b; font-style: italic; background: rgba(0,0,0,0.10); }" +

        ".jpe-loading.jpe-expired { color: #777; font-style: italic; background: rgba(0,0,0,0.08); }" +

        ".jpe-text-embed { display: block; color: #FFDC91; white-space: pre-wrap; word-break: break-word; margin-top: 5em; }" +

        "article:has(.jpe-text-embed) .post-container, article:has(.jpe-embed) .post-container, article.jpe-embed-live .post-container { min-width: 480px; max-width: none; }" +
        "article:has(.jpe-text-embed) blockquote, article:has(.jpe-embed) blockquote, article.jpe-embed-live blockquote { min-width: 320px; }" +

        ".mgc-md5-filtered { display: none !important; }" +
        ".mgc-md5-filtered-stub { display: inline-block; padding: 2px 6px; margin: 2px 0; font-size: 11px; opacity: 0.6; font-style: italic; border: 1px dashed rgba(128,128,128,0.4); border-radius: 3px; cursor: pointer; user-select: none; }" +
        ".mgc-md5-filtered-stub:hover { opacity: 0.85; }" +
        ".mgc-subject-filter-stub { display: block; padding: 4px 8px; margin: 4px 0; font-size: 12px; opacity: 0.7; font-style: italic; border: 1px dashed rgba(128,128,128,0.5); border-radius: 4px; cursor: pointer; user-select: none; max-width: 600px; }" +
        ".mgc-subject-filter-stub:hover { opacity: 0.95; }" +
        ".lewd_color { animation: lewd_blinker 0.7s linear " + getIterations(0.7) + "; color: pink; } @keyframes lewd_blinker { 50% { color: #FFD6E1 } }" +
        ".decision_roll { animation: decision_blinker 0.4s linear 2; color: lightgreen; } @keyframes decision_blinker { 50% { color: green } }" +
        ".planeptune_wins { animation: planeptune_blinker 0.6s linear " + getIterations(0.6) + "; color: mediumpurple; } @keyframes planeptune_blinker { 50% { color: #fff} }" +
        ".lastation_wins { animation: lastation_blinker 0.6s linear " + getIterations(0.6) + "; color: #000; } @keyframes lastation_blinker { 50% { color: #fff} }" +
        ".lowee_wins { animation: lowee_blinker 0.6s linear " + getIterations(0.6) + "; color: #e6e6ff; } @keyframes lowee_blinker { 50% { color: #c59681 }}" +
        ".leanbox_wins { animation: leanbox_blinker 0.6s linear " + getIterations(0.6) + "; color: #4dff4d; } @keyframes leanbox_blinker { 50% { color: #fff} }" +
        ".thousand_pyu { animation: pyu_blinker 0.4s linear " + getIterations(0.4) + "; color: aqua; } @keyframes pyu_blinker { 50% { color: white } }" +
        ".filtered :not(.filter-stub) { display: none }" +
        ".shaking_post { animation: screaming 0.5s linear 0s " + getVibrationIterations() + "; } @keyframes screaming { 0% { -webkit-transform: translate(2px, 1px) rotate(0deg); } 10% { -webkit-transform: translate(-1px, -2px) rotate(-1deg); } 20% { -webkit-transform: translate(-3px, 0px) rotate(1deg); } 30% { -webkit-transform: translate(0px, 2px) rotate(0deg); } 40% { -webkit-transform: translate(1px, -1px) rotate(1deg); } 50% { -webkit-transform: translate(-1px, 2px) rotate(-1deg); } 60% { -webkit-transform: translate(-3px, 1px) rotate(0deg); } 70% { -webkit-transform: translate(2px, 1px) rotate(-1deg); } 80% { -webkit-transform: translate(-1px, -1px) rotate(1deg); } 90% { -webkit-transform: translate(2px, 2px) rotate(0deg); } 100% { -webkit-transform: translate(1px, -2px) rotate(-1deg); } }" +

        ".mgc-toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%) translateY(-10px); background: rgba(30,30,40,0.92); color: #fff; padding: 10px 18px; border-radius: 8px; font-family: sans-serif; font-size: 14px; z-index: 100000; box-shadow: 0 4px 16px rgba(0,0,0,0.4); opacity: 0; transition: opacity 0.3s ease, transform 0.3s ease; white-space: pre-wrap; max-width: 80vw; pointer-events: none; }" +

        "#mgcPlFrame { position: fixed; top: 50%; left: auto; right: 0; width: 320px; height: 380px; min-width: 240px; min-height: 220px; max-width: 95vw; max-height: 95vh; background: linear-gradient(180deg, #2a2a35 0%, #1d1d27 100%); color: #eee; border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); font-family: sans-serif; font-size: 13px; z-index: 9999; overflow: hidden; user-select: none; border: 1px solid #3a3a48; display: flex; flex-direction: column; }" +
        ".mgcPlResize { position: absolute; z-index: 50; }" +
        ".mgcPlResizeT { top: 0; left: 10px; right: 10px; height: 5px; cursor: ns-resize; }" +
        ".mgcPlResizeB { bottom: 0; left: 10px; right: 10px; height: 5px; cursor: ns-resize; }" +
        ".mgcPlResizeL { left: 0; top: 10px; bottom: 10px; width: 5px; cursor: ew-resize; }" +
        ".mgcPlResizeR { right: 0; top: 10px; bottom: 10px; width: 5px; cursor: ew-resize; }" +
        ".mgcPlResizeTL { top: 0; left: 0; width: 12px; height: 12px; cursor: nwse-resize; }" +
        ".mgcPlResizeTR { top: 0; right: 0; width: 12px; height: 12px; cursor: nesw-resize; }" +
        ".mgcPlResizeBL { bottom: 0; left: 0; width: 12px; height: 12px; cursor: nesw-resize; }" +
        ".mgcPlResizeBR { bottom: 0; right: 0; width: 12px; height: 12px; cursor: nwse-resize; }" +
        "#mgcPldragArea { display: flex; align-items: center; padding: 6px 10px; background: rgba(255,255,255,0.04); cursor: move; border-bottom: 1px solid rgba(255,255,255,0.06); }" +
        "#mgcPldragArea .mgcPlGrip { font-size: 14px; opacity: 0.55; margin-right: 8px; letter-spacing: -2px; }" +
        "#mgcPldragArea .mgcPlTitle { flex: 1; font-weight: 600; font-size: 13px; letter-spacing: 0.3px; color: #eaeaea; }" +
        "#mgcPldragArea .mgcPlClose { cursor: pointer; opacity: 0.6; padding: 0 6px; font-size: 16px; line-height: 1; }" +
        "#mgcPldragArea .mgcPlClose:hover { opacity: 1; color: #ff8888; }" +
        "#mgcPlFrame .mgcPlControlsRow { display: flex; gap: 4px; padding: 8px 10px; justify-content: center; }" +
        "#mgcPlFrame .mgcPlBtn { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); color: #eee; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 12px; transition: background 0.15s ease; }" +
        "#mgcPlFrame .mgcPlBtn:hover { background: rgba(255,255,255,0.14); }" +
        "#mgcPlFrame .mgcPlBtn:active { background: rgba(255,255,255,0.2); }" +
        "#mgcPlFrame .mgcPlSliderRow { display: flex; align-items: center; padding: 4px 10px; gap: 8px; }" +
        "#mgcPlFrame .mgcPlSliderRow label { font-size: 11px; color: #aaa; min-width: 22px; }" +
        "#mgcPlFrame input[type=range] { flex: 1; -webkit-appearance: none; appearance: none; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; outline: none; }" +
        "#mgcPlFrame input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; background: #ffb6c1; border-radius: 50%; cursor: pointer; }" +
        "#mgcPlFrame input[type=range]::-moz-range-thumb { width: 12px; height: 12px; background: #ffb6c1; border-radius: 50%; cursor: pointer; border: none; }" +
        "#megucaplaylist { width: 100%; flex: 1; min-height: 60px; background: rgba(0,0,0,0.25); color: #ddd; border: none; border-top: 1px solid rgba(255,255,255,0.06); padding: 4px 0; font-size: 12px; box-sizing: border-box; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.18) transparent; }" +
        "#megucaplaylist::-webkit-scrollbar { width: 8px; }" +
        "#megucaplaylist::-webkit-scrollbar-track { background: transparent; }" +
        "#megucaplaylist::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 4px; }" +
        "#megucaplaylist::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.32); }" +
        "#megucaplaylist::-webkit-scrollbar-corner { background: transparent; }" +

        "#megucaplaylist { overflow-y: auto; user-select: none; }" +
        "#megucaplaylist .mgcPlSong { display: flex; align-items: center; padding: 3px 10px; cursor: pointer; gap: 6px; }" +
        "#megucaplaylist .mgcPlSong:hover { background: rgba(255,255,255,0.06); }" +
        "#megucaplaylist .mgcPlSong.mgcPlSelected { background: #ffb6c1; color: #2a2a35; }" +
        "#megucaplaylist .mgcPlSongText { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }" +
        "#megucaplaylist .mgcPlSongRemove { flex-shrink: 0; padding: 0 6px; color: inherit; opacity: 0.6; font-weight: bold; }" +
        "#megucaplaylist .mgcPlSongRemove:hover { opacity: 1; color: #ff7b7b; }" +
        "#mgcPlFrame .mgcPlEmpty { padding: 20px 10px; text-align: center; color: #888; font-style: italic; }";
    document.head.appendChild(css);
}

function getIterations(period) {
    if (flashingDuration == "infinite") return "infinite";
    return flashingDuration / period;
}

function getVibrationIterations() {
    if (vibrationDuration == "infinite") return "infinite";
    return vibrationDuration * 2;
}

function getCurrentOptions() {
    for (var i = 0; i < onOffOptions.length; i++) {
        var id = onOffOptions[i][0];
        var setting = getFunc(id);

        if (offByDefaultOptions.has(id)) {
            if (setting === "on") currentlyEnabledOptions.add(id);
        } else if (setting != "off") {
            currentlyEnabledOptions.add(id);
        }
    }
    flashingDuration = parseFloat(getFunc("flashing"));
    if (isNaN(flashingDuration)) flashingDuration = "infinite";

    vibrationDuration = parseFloat(getFunc("vibration"));
    if (isNaN(vibrationDuration)) vibrationDuration = 4;

    chuuCount = parseInt(getFunc("chuuCount"));
    if (isNaN(chuuCount)) chuuCount = 0;

    var filters = getFunc("customFilterText");
    if (filters != undefined) {
        customFilterText = filters;

        if (customFilterText.indexOf('phash:') === -1) {

            customFilterText = customFilterText.replace(/\n+$/, '') + '\n';
            customFilterText += "#phash:<16-hex-char perceptual hash> -- matches similar images even after re-encoding; added via the post menu's Filter pHash entry\n";
            setFunc('customFilterText', customFilterText);
        } else if (/\n\n+#phash:<16-hex-char perceptual hash>/.test(customFilterText)) {

            customFilterText = customFilterText.replace(/\n\n+(#phash:<16-hex-char perceptual hash>)/g, '\n$1');
            setFunc('customFilterText', customFilterText);
        }

        var subjectExample = "#subject:<word/regex> -- hides matching threads on catalog/board/all listings; plain words match whole-word and case-insensitively (subject:gen matches Gen Thread but not generation); thread is still viewable by URL";
        var phashExampleRe = /(^#phash:<16-hex-char perceptual hash>[^\n]*)$/m;
        var subjectExampleRe = /^#subject:<word\/regex>[^\n]*\n?/m;
        var hasSubjectExample = subjectExampleRe.test(customFilterText);
        if (!hasSubjectExample) {
            if (phashExampleRe.test(customFilterText)) {
                customFilterText = customFilterText.replace(phashExampleRe, '$1\n' + subjectExample);
            } else {
                customFilterText = customFilterText.replace(/\n+$/, '') + '\n' + subjectExample + '\n';
            }
            setFunc('customFilterText', customFilterText);
        } else if (phashExampleRe.test(customFilterText)) {

            var phashMatch = customFilterText.match(phashExampleRe);
            var phashIdx = customFilterText.indexOf(phashMatch[0]);
            var afterPhashIdx = phashIdx + phashMatch[0].length + 1;
            var subjectMatch = customFilterText.match(subjectExampleRe);
            var subjectIdx = customFilterText.indexOf(subjectMatch[0]);
            if (subjectIdx !== afterPhashIdx) {

                customFilterText = customFilterText.replace(subjectExampleRe, '');
                customFilterText = customFilterText.replace(phashExampleRe, '$1\n' + subjectExample);
                setFunc('customFilterText', customFilterText);
            }
        }
        setupFilters();
    }
}

function setupFilters() {
    var filters = customFilterText.split("\n");
    for (var i = 0; i < filters.length; i++) {
        var filter = filters[i];
        if (filter.startsWith("#")) continue;
        if (filter == "") continue;

        if (filter.startsWith("md5:")) {
            var h = filter.substring(4).trim().toLowerCase();
            if (h) customFilters.push(["md5", h]);
            continue;
        }

        if (filter.startsWith("phash:")) {
            var p = filter.substring(6).trim().toLowerCase();
            if (/^[0-9a-f]{16}$/.test(p)) customFilters.push(["phash", p]);
            continue;
        }

        if (filter.startsWith("subject:")) {
            var subjBody = filter.substring(8);
            try {

                var isPlainWord = /^[A-Za-z0-9_]+$/.test(subjBody);
                var subjReg = isPlainWord
                    ? new RegExp("\\b" + subjBody + "\\b", "i")
                    : new RegExp(subjBody);
                customFilters.push(["subject", subjReg]);
            } catch (e) {  }
            continue;
        }
        var type = "text";
        for (var potentialType of filterTypes.keys()) {
            if (filter.startsWith(potentialType + ":")) {
                type = potentialType;
                filter = filter.substring(potentialType.length + 1);
                break;
            }
        }
        var reg;
        try {
            reg = new RegExp(filter);
        } catch (e) {
            continue;
        }
        customFilters.push([type, reg]);
    }
}

function handlePost(post) {
    if (!post) return;
    if (currentlyEnabledOptions.has("sekritPosting")) {

        var jpClass = '[' + nipponeseIndex[1] + ']';
        var secretNewRe = new RegExp('<code class="code-tag"></code>(' + jpClass + '+?)<code class="code-tag"></code>', 'g');
        var secretOldRe = new RegExp('<code class="code-tag"></code><del>(' + jpClass + '+?)</del><code class="code-tag"></code>', 'g');
        var secretNew = findMultipleShitFromAString(post.innerHTML, secretNewRe);
        for (let j = secretNew.length - 1; j >= 0; j--) {
            parseSecretPost(post, secretNew[j]);
        }
        var secretOld = findMultipleShitFromAString(post.innerHTML, secretOldRe);
        for (let j = secretOld.length - 1; j >= 0; j--) {
            parseSecretPost(post, secretOld[j]);
        }

        if (post.innerHTML.indexOf('class="sekrit_text"') !== -1) {
            var secretQuote = findMultipleShitFromAString(post.innerHTML, /[ >]󠁂&gt;󠁂&gt;([\d]+)(?:[ <]+)/g);
            for (let j = secretQuote.length - 1; j >= 0; j--) {
                parseSecretQuote(post, secretQuote[j]);
            }
        }
    }
    if (currentlyEnabledOptions.has("sharesOption")) {
        var shares = findMultipleShitFromAString(post.innerHTML, /\[([^\]\[]*)\] <strong( class="\w+")?>#(\d+)d(\d+) \(([\d +]* )*= (?:\d+)\)<\/strong>/g);
        for (let j = shares.length - 1; j >= Math.max(0, shares.length - 4); j--) {
            parseShares(post, shares[j]);
        }
    }
    if (currentlyEnabledOptions.has("pyuOption")) {
        var pyu = findMultipleShitFromAString(post.innerHTML, /<strong>#pyu \(([\d+]*)\)<\/strong>/g);
        for (let j = pyu.length - 1; j >= 0; j--) {
            parsePyu(post, pyu[j]);
        }
    }
    if (currentlyEnabledOptions.has("mathOption")) {
        var math = findMultipleShitFromAString(post.innerHTML, /#math\(((?:[\d\-+/*%().^ ]*(?:log)*)*)\)/g);
        for (let j = math.length - 1; j >= 0; j--) {
            parseMath(post, math[j]);
        }
    }
    if (currentlyEnabledOptions.has("chuuOption")) {
        var chuu = findMultipleShitFromAString(post.innerHTML, /#chuu\( ?(\d*) ?\)/g);
        for (let j = chuu.length - 1; j >= 0; j--) {
            parseChuu(post, chuu[j]);
        }
    }
    var RGB = findMultipleShitFromAString(post.innerHTML, /\^\[ ?(\d+)[ ,](\d+)[ ,](\d+) ?\]\{(.*?)\}/g);
    for (let j = RGB.length - 1; j >= 0; j--) {
        parseCustomColorRGB(post, RGB[j]);
    }
    var HEX = findMultipleShitFromAString(post.innerHTML, /\^\[ ?#? ?(\w+) ?\]\{(.*?)\}/g);
    for (let j = HEX.length - 1; j >= 0; j--) {
        parseCustomColorHEX(post, HEX[j]);
    }
    if (currentlyEnabledOptions.has("decideOption")) {
        var decide;
        decide = findMultipleShitFromAString(post.innerHTML, /\[([^#\]\[]*)\]\s<strong( class="\w+")?>#d([0-9]+) \(([0-9]+)\)<\/strong>/g);
        for (let j = decide.length - 1; j >= 0; j--) {
            parseDecide(post, decide[j], false);
        }
        decide = findMultipleShitFromAString(post.innerHTML, /(?:<blockquote>|<br>)([^><]*)(\s|<br>)<strong( class="\w+")?>#d([0-9]+) \(([0-9]+)\)<\/strong>/g);
        for (let j = decide.length - 1; j >= 0; j--) {
            parseDecide(post, decide[j], true);
        }
    }
    if (currentlyEnabledOptions.has("dumbPosters")) {
        checkForDumbPost(post);
    }
    if (currentlyEnabledOptions.has("screamingPosters")) {
        checkForScreamingPost(post);
    }
    if (currentlyEnabledOptions.has("filterPosts")) {
        filterPost(post);
    }

    applyMD5FilterToPost(post);

    applyPhashFilterToPost(post);

}

var mgcInitialLoadDone = false;

function readPostsForData() {
    var posts = document.getElementsByClassName('post-container');
    for (var i = 0; i < posts.length; i++) {
        handlePost(posts[i]);
    }
}

function parseCustomColorRGB(post, customColor) {
    var before = post.innerHTML.substring(0, customColor.index);
    var after = post.innerHTML.substring(customColor.index + customColor[0].length);
    var colorTag = "#" + ((1 << 24) + (Number(customColor[1]) << 16) + (Number(customColor[2]) << 8) + Number(customColor[3])).toString(16).slice(1);
    post.innerHTML = before + "<font color=\"" + colorTag + "\">" + customColor[4] + "</font>" + after;
}

function parseCustomColorHEX(post, customColor) {
    var before = post.innerHTML.substring(0, customColor.index);
    var after = post.innerHTML.substring(customColor.index + customColor[0].length);
    var colorTag = "#" + customColor[1];
    post.innerHTML = before + "<font color=\"" + colorTag + "\">" + customColor[2] + "</font>" + after;
}

function parsePyu(post, pyu) {
    var n = pyu[1];
    if (n % 1000 == 0) {
        var before = post.innerHTML.substring(0, pyu.index);
        var after = post.innerHTML.substring(pyu.index + pyu[0].length);
        var pyuHTML = "<strong class=\"thousand_pyu\"> 💦 " + pyu[0].substring(8) + " 💦 ";
        post.innerHTML = before + pyuHTML + after;
    }
}

function parseMath(post, math) {
    var expr = math[1];
    expr = parseMath_addPow(expr).replace(/log/g, 'Math.log');
    var result;
    try {
        result = eval(expr);
    } catch (err) {
        result = '???';
    }
    if (isNaN(result)) result = '???';

    var before = post.innerHTML.substring(0, math.index);
    var after = post.innerHTML.substring(math.index + math[0].length);
    var mathHTML = "<strong>" + math[0].substring(0, 5) + " " + math[0].substring(5, math[0].length - 1) + " = " + result + ")</strong>";
    post.innerHTML = before + mathHTML + after;
}

function parseMath_addPow(str) {
    for (let i = str.length - 1; i >= 0; i--) {
        if (str[i] !== "^") continue;
        let parentheses = 0;
        const operators = /[-+*/%^]/;
        let j;
        for (j = i + 1; j < str.length; j++) {
            if (str[j] === "(") parentheses++;
            else if (str[j] === ")" && parentheses > 0) parentheses--;
            else if (operators.test(str[j]) && parentheses === 0) break;
        }
        let k;
        parentheses = 0;
        for (k = i - 1; k >= 0; k--) {
            if (str[k] === ")") parentheses++;
            else if (str[k] === "(" && parentheses > 0) parentheses--;
            else if (operators.test(str[k]) && parentheses === 0) break;
        }
        k++;
        str = str.substring(0, k) + "Math.pow(" + str.substring(k, i) + "," +
            str.substring(i + 1, j) + ")" + str.substring(j);
        i += 9;
    }
    return str;
}

function parseChuu(post, chuu) {
    var postNum = chuu[1];
    var kissedPost = document.getElementById("p" + postNum);
    var before = post.innerHTML.substring(0, chuu.index);
    var after = post.innerHTML.substring(chuu.index + chuu[0].length);

    var isYouChuu = false;
    if (kissedPost) {
        var kHeader = kissedPost.querySelector("header");
        var kName = kHeader ? kHeader.getElementsByTagName("B")[0] : null;
        if (kName && kName.getElementsByTagName("I").length > 0) {
            var ownHeader = post.parentNode && post.parentNode.querySelector("header");
            var ownName = ownHeader ? ownHeader.getElementsByTagName("B")[0] : null;
            var isSelf = !!(ownName && ownName.getElementsByTagName("I").length > 0);
            if (!isSelf) isYouChuu = true;
        }
    }

    var chuuHTML = "<strong class=\"lewd_color\">#chuu~(" + chuu[1] + ")</strong>";
    post.innerHTML = before + chuuHTML + after;

    if (isYouChuu) {
        chuuCount = parseInt(getFunc("chuuCount", chuuCount));
        if (isNaN(chuuCount)) chuuCount = 0;
        chuuCount++;
        setFunc("chuuCount", chuuCount);
        var ctrEl = document.getElementById("chuu-counter");
        if (ctrEl) ctrEl.innerHTML = chuuCount;
        var message = '<span style="color:pink">chuu</span>~';
        if (chuuCount % 10 === 0) {
            message += "\nCongratulations on your pregnancy!\nYou now have " +
                chuuCount / 10 + " children!";
        }
        showToast(message, 5000, true);
    }
}

function parseDecide(post, decide, isSmart) {
    var offset = (isSmart) ? 1 : 0;
    var options = decide[1].split(",");
    var n = decide[3 + offset];
    var m = decide[4 + offset];

    var before = post.innerHTML.substring(0, decide.index);
    var after = post.innerHTML.substring(decide.index + decide[0].length);

    if (options.length != n || n == 1) return;
    options[m - 1] = "<strong class=\"decision_roll\">" + options[m - 1] + "</strong>";
    var newInner = options.toString();
    var retreivedRoll;
    if (decide[2 + offset] == null) {
        retreivedRoll = " <strong>#d" + n + " (" + m + ")</strong>";
    } else {
        retreivedRoll = " <strong" + decide[2 + offset] + ">#d" + n + " (" + m + ")</strong>";
    }
    if (isSmart) {
        if (decide[0].substring(0, 3) === "<br") before += "<br>";
        else before += "<blockquote>";
        newInner += decide[2];
    }
    post.innerHTML = before + newInner + retreivedRoll + after;
}

function parseShares(post, shares) {
    var options = shares[1].split(",");
    var n = shares[3];
    var maxShares = shares[4];
    var shareValues = shares[5].split(" + ");
    for (var j = 0; j < shareValues.length; j++) shareValues[j] = Number(shareValues[j]);

    var before = post.innerHTML.substring(0, shares.index);
    var after = post.innerHTML.substring(shares.index + shares[0].length);
    var highestValue = Math.max.apply(Math, shareValues);

    if (options.length != n || n == 1 || n == 0) return;

    for (var j2 = 0; j2 < shareValues.length; j2++) {
        var formattedRoll = " (" + shareValues[j2] + "/" + maxShares + ")";
        if (shareValues[j2] == highestValue) {
            if (options[j2].match(/(^|\W)planeptune($|\W)(?!\w)/i)) {
                options[j2] = "</strong><strong class=\"planeptune_wins\">" + options[j2] + formattedRoll + "</strong><strong>";
            } else if (options[j2].match(/(^|\W)lastation($|\W)(?!\w)/i)) {
                options[j2] = "</strong><strong class=\"lastation_wins\">" + options[j2] + formattedRoll + "</strong><strong>";
            } else if (options[j2].match(/(^|\W)lowee($|\W)(?!\w)/i)) {
                options[j2] = "</strong><strong class=\"lowee_wins\">" + options[j2] + formattedRoll + "</strong><strong>";
            } else if (options[j2].match(/(^|\W)leanbox($|\W)(?!\w)/i)) {
                options[j2] = "</strong><strong class=\"leanbox_wins\">" + options[j2] + formattedRoll + "</strong><strong>";
            } else {
                options[j2] = "</strong><strong class=\"decision_roll\">" + options[j2] + formattedRoll + "</strong><strong>";
            }
        } else {
            options[j2] = options[j2] + formattedRoll;
        }
    }

    var newInner = options.join("<br>");
    if (before.substring(before.length - 4) != "<br>" && before.substring(before.length - 4) != "ote>") {
        before += "<br>";
    }
    if (after.substring(0, 4) != "<br>" && after.substring(0, 4) != "<blo") {
        after = "<br>" + after;
    }
    post.innerHTML = before + "<strong>" + newInner + "</strong>" + after;
}

function findMultipleShitFromAString(s, re) {
    var result = [];
    var m;
    while (true) {
        m = re.exec(s);
        if (m) result.push(m);
        else break;
    }
    return result;
}

function setObservers() {
    var thread = document.getElementById("thread-container");
    if (!thread) return;

    var config = { attributes: true, childList: true, subtree: true, attributeOldValue: true };

    var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.addedNodes.length == 0) {
                if (mutation.type == "attributes" && mutation.attributeName == "class") {
                    var post = mutation.target;
                    var postContent = post.getElementsByClassName("post-container")[0];
                    if (postContent != undefined) {
                        if (currentlyEnabledOptions.has("cancelposters")) {
                            if (post.classList.contains("hidden") && postContent.innerText == "") {
                                var cancelled = false;
                                for (var j = 0; j < mutations.length; j++) {
                                    var removeEvt = mutations[j];
                                    if (removeEvt.type == "childList") {

                                        if (removeEvt.target !== post) continue;
                                        for (var i = 0; i < removeEvt.removedNodes.length; i++) {
                                            var node = removeEvt.removedNodes[i];
                                            if (!((node.classList && node.classList.contains("popup-menu")) ||
                                                node.id == "post-controls" ||
                                                node.id == "text-input")) {
                                                removeEvt.target.appendChild(removeEvt.removedNodes[i]);
                                                cancelled = true;
                                            }
                                        }
                                    }
                                }
                                if (cancelled) {
                                    post.classList.remove("hidden");
                                    post.style.opacity = "0.5";
                                    postContent.cancelled = true;
                                    post.addEventListener("mousemove", function (e) { e.stopPropagation(); });
                                }
                            }
                        }
                        if ((mutation.oldValue.split(" ").includes("editing") ||
                            mutation.oldValue.split(" ").includes("reply-form")) &&
                            !post.classList.contains("editing") &&
                            !post.classList.contains("reply-form")) {
                            handlePost(postContent);
                            maybeScanNewPostForSecretMedia(postContent);
                            if (currentlyEnabledOptions.has("enablemegucaplayer")) {
                                var fc = post.getElementsByTagName("figcaption")[0];
                                if (fc) mgcPl_addNewSong(fc);
                            }
                        }
                    }
                }
            } else {
                var postItself;
                if (mutation.target.nodeName == "BLOCKQUOTE") {
                    if (mutation.target.parentNode &&
                        mutation.target.parentNode.parentNode &&
                        mutation.target.parentNode.parentNode.nodeName == "ARTICLE") {
                        postItself = mutation.target.parentNode.parentNode;
                    }
                } else if (mutation.addedNodes[0].nodeName == "ARTICLE") {
                    postItself = mutation.addedNodes[0];
                }

                if (postItself == undefined) return;
                var postContent = postItself.getElementsByClassName("post-container")[0];
                if (postContent == undefined) return;

                if (postItself.getAttribute("class").includes("editing") || postItself.getAttribute("class").includes("reply-form")) {
                    if (postItself.getAttribute("class").includes("reply-form")) {
                        if (currentlyEnabledOptions.has("annoyingFormatting")) addFormatButton(postItself);
                        if (currentlyEnabledOptions.has("preSubmitOption")) overrideDoneButton(postItself);
                    }
                    return;
                }
                handlePost(postContent);
                maybeScanNewPostForSecretMedia(postContent);
                if (currentlyEnabledOptions.has("enablemegucaplayer")) {
                    var fc2 = postItself.getElementsByTagName("figcaption")[0];
                    if (fc2) mgcPl_addNewSong(fc2);
                }
            }
        });
    });

    observer.observe(thread, config);
}

function addFormatButton(post) {
    if (document.getElementById("format-button")) return;
    var button = document.createElement("input");
    button.name = "format";
    button.value = "Format";
    button.type = "button";
    button.id = "format-button";
    button.onclick = formatPostText;
    var controls = document.getElementById("post-controls");
    if (controls) controls.appendChild(button);
}

function formatPostText() {
    var input = document.getElementById("text-input");
    if (!input) return;
    input.value = input.value.split(" ").map(formatWord).join(" ");
    var evt = document.createEvent('HTMLEvents');
    evt.initEvent('input', false, true);
    input.dispatchEvent(evt);
}

function formatWord(s) {
    var format = ["~~", "**", "@@", "``"][Math.floor(Math.random() * 4)];
    return format + s + format;
}

function checkForDumbPost(post) {
    if (post.cancelled) {
        addToName(post, " (dumb cancelposter)");
        return;
    }
    var text = post.textContent;
    if (text.match("~") != null) {
        addToName(post, " (dumb ~poster)");
        return;
    }
    if ((text == "" || text == " ") && post.getElementsByTagName("figure").length == 0) {
        var quality = (currentlyEnabledOptions.has("dumbblanc")) ? "dumb" : "cute";
        addToName(post, " (" + quality + " blancposter)");
        return;
    }
    var dumbRegex = /^(?:>>\d* (?:\(You\) )?# )*(dumb ?.{0,20}posters?)$/i;
    if (text.match(dumbRegex) != null) {
        let posterType = text.match(dumbRegex)[1];
        addToName(post, " (dumb '" + posterType + "' poster)");
        return;
    }
    var cuteRegex = /^(?:>>\d* (?:\(You\) )?# )*(cute ?.{0,20}posters?)$/i;
    if (text.match(cuteRegex) != null) {
        let posterType = text.match(cuteRegex)[1];
        addToName(post, " (cute '" + posterType + "' poster)");
        return;
    }
    if (text.match(/^(?:>>\d* (?:\(You\) )?# )*wait anon$/i) != null) {
        addToName(post, " (Dumb haiku poster / 'wait anon' is all she says / Don't wait, run away!)");
        return;
    }
    if (text.match(/virus/i) != null) {
        addToName(post, " (virus post do not read)");
        return;
    }
    var uppers = findMultipleShitFromAString(text, /[A-Z]/g);
    var Yous = findMultipleShitFromAString(text, />>\d* \(You\)/g);
    if (uppers.length == Yous.length) {
        var lowers = findMultipleShitFromAString(text, /[a-z]/g);
        if (lowers.length >= 5) {
            addToName(post, " (dumb lowercaseposter)");
            return;
        }
    }
    addToName(post, "");
}

function checkForScreamingPost(post) {
    var text = post.textContent;
    var wholePost = post.parentElement;

    if (!wholePost) return;
    if (wholePost.parentElement && wholePost.parentElement.closest('article')) return;
    text = text.replace(/(?:>>\d* (?:\(You\) )?#)/g, "").replace(/(?:>>\d*)/g, "").replace(/[\s\W\d_]/g, "");
    var isBlanc = (text.length == 0);
    var hasLower = text.match("[a-z]");
    var isShort = (text.length <= 5);
    if (!isShort && !isBlanc && !hasLower && !wholePost.className.match("shaking_post")) {
        wholePost.className += " shaking_post";
    }
}

function addToName(post, message) {
    var name = post.parentNode.getElementsByClassName("name spaced")[0];
    if (!name) return;
    var newText = document.createTextNode(message);
    newText.id = "dumbposter";
    name.parentNode.childNodes.forEach((node) => {
        if (node.id == "dumbposter") name.parentNode.removeChild(node);
    });
    name.parentNode.insertBefore(newText, name.nextSibling);
}

function filterPost(postContent) {
    var post = postContent.parentNode;
    if (post.classList.contains("filtered") || post.classList.contains("filtered-shown")) return;
    for (var i = 0; i < customFilters.length; i++) {
        var filter = customFilters[i];
        var type = filter[0];

        if (type === "md5" || type === "phash" || type === "subject") continue;
        var reg = filter[1];
        var textToMatch;
        var selector = filterTypes.get(type);
        var elt = post.querySelector(selector);
        if (elt != null) {
            if (type == "flag") textToMatch = elt.title;
            else textToMatch = elt.innerText;
        }
        if (textToMatch != undefined && textToMatch.match(reg)) {
            post.classList.add("filtered");
            var stub = document.createElement("div");
            stub.classList.add("filter-stub");
            var name = filter[1].toString();
            name = name.substring(1, name.length - 1);
            stub.innerText = "Post filtered (" + filter[0] + ":" + name + ")";
            stub.onclick = showFilteredPost;
            post.appendChild(stub);
        }
    }
}

function mgcExtractMediaHash(article) {
    if (!article) return null;
    var anchor = article.querySelector('figure a[href*="/assets/images/src/"]')
        || article.querySelector('video source[src*="/assets/images/src/"]')
        || article.querySelector('figcaption a[href*="/assets/images/src/"]');
    if (!anchor) return null;
    var src = anchor.href || anchor.src || '';
    var m = src.match(/\/assets\/images\/src\/([a-f0-9]+)\./i);
    return m ? m[1].toLowerCase() : null;
}

function mgcMakeMediaFilterStub(label, title) {
    var s = document.createElement('div');
    s.className = 'mgc-md5-filtered-stub';
    s.textContent = label;
    s.title = title + '\nClick to show/hide the media.';
    s.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var fig = s.previousElementSibling;
        if (!fig || fig.tagName !== 'FIGURE') return;
        if (fig.classList.contains('mgc-md5-filtered')) {
            fig.classList.remove('mgc-md5-filtered');
        } else {
            fig.classList.add('mgc-md5-filtered');
        }
    });
    return s;
}

function applyMD5FilterToPost(postContent) {
    if (!postContent) return;
    var md5Set = null;
    for (var i = 0; i < customFilters.length; i++) {
        if (customFilters[i][0] === "md5") {
            if (!md5Set) md5Set = new Set();
            md5Set.add(customFilters[i][1]);
        }
    }
    if (!md5Set) return;
    var article = postContent.parentNode;
    var hash = mgcExtractMediaHash(article);
    if (!hash || !md5Set.has(hash)) return;

    if (currentlyEnabledOptions.has("hideMD5Posts")) {

        if (article.classList.contains("filtered") || article.classList.contains("filtered-shown")) return;
        article.classList.add("filtered");
        var stub = document.createElement("div");
        stub.classList.add("filter-stub");
        stub.innerText = "Post filtered (md5:" + hash + ")";
        stub.onclick = showFilteredPost;
        article.appendChild(stub);
        return;
    }

    var fig = article.querySelector('figure');
    if (fig) {
        fig.classList.add('mgc-md5-filtered');

        var nextEl = fig.nextElementSibling;
        var alreadyStubbed = nextEl && nextEl.classList && nextEl.classList.contains('mgc-md5-filtered-stub');
        if (!alreadyStubbed) {
            fig.insertAdjacentElement('afterend', mgcMakeMediaFilterStub(
                '[filtered media: ' + hash.substring(0, 8) + '…]',
                'MD5: ' + hash + ' (remove from filter list to unhide permanently)'
            ));
        }
    }
}

const URL_PREFIXES = {
    'waifuvault.moe': 'w',
};
const REVERSE_PREFIXES = Object.fromEntries(
    Object.entries(URL_PREFIXES).map(([k, v]) => [v, k])
);
const ALLOWED_HOSTS = Object.keys(URL_PREFIXES);

const AWOO_IMG_RE = /\/assets\/images\/src\/[0-9a-f]+\.(png|jpe?g|webp|gif|bmp|mp4|webm|mov|m4v)$/i;

const jpeLog = (...a) => console.log('[jpe-awoo]', ...a);
const jpeWarn = (...a) => console.warn('[jpe-awoo]', ...a);
const jpeErr  = (...a) => console.error('[jpe-awoo]', ...a);

const concatBytes = (arrs) => {
    let total = 0;
    for (const a of arrs) total += a.length;
    const out = new Uint8Array(total);
    let off = 0;
    for (const a of arrs) { out.set(a, off); off += a.length; }
    return out;
};

const eqBytes = (a, b, aOff = 0) => {
    if (a.length - aOff < b.length) return false;
    for (let i = 0; i < b.length; i++) if (a[aOff + i] !== b[i]) return false;
    return true;
};

const bufIndexOf = (haystack, needle, from = 0) => {
    const n = needle.length;
    if (n === 0) return from;
    const end = haystack.length - n;
    outer: for (let i = from; i <= end; i++) {
        for (let j = 0; j < n; j++) {
            if (haystack[i + j] !== needle[j]) continue outer;
        }
        return i;
    }
    return -1;
};

const bytesFromString = (s) => new TextEncoder().encode(s);
const stringFromBytes = (b) => new TextDecoder('latin1').decode(b);

const readU32BE = (b, off) =>
    ((b[off] << 24) | (b[off+1] << 16) | (b[off+2] << 8) | b[off+3]) >>> 0;
const writeU32BE = (b, off, v) => {
    b[off]   = (v >>> 24) & 0xff;
    b[off+1] = (v >>> 16) & 0xff;
    b[off+2] = (v >>> 8)  & 0xff;
    b[off+3] = v & 0xff;
};

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c >>> 0;
    }
    return t;
})();

const crc32 = (bytes) => {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
};

const PNG_SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function* pngChunks(png) {
    if (!eqBytes(png, PNG_SIG)) throw new Error('Not a PNG');
    let off = 8;
    while (off < png.length) {
        const len = readU32BE(png, off);
        const name = stringFromBytes(png.subarray(off + 4, off + 8));
        const data = png.subarray(off + 8, off + 8 + len);
        yield { name, data, off };
        off += 12 + len;
        if (name === 'IEND') break;
    }
}

function buildPng(chunks) {
    const parts = [PNG_SIG];
    for (const { name, data } of chunks) {
        const len = new Uint8Array(4);
        writeU32BE(len, 0, data.length);
        const nameBytes = bytesFromString(name);
        const nameAndData = concatBytes([nameBytes, data]);
        const crc = new Uint8Array(4);
        writeU32BE(crc, 0, crc32(nameAndData));
        parts.push(len, nameAndData, crc);
    }
    return concatBytes(parts);
}

const revbyte = (n, len = 8) => {
    let acc = 0, n2 = n, len2 = len;
    while (len2) {
        acc = acc * 2 + (n2 & 1);
        n2 >>= 1;
        len2--;
    }
    return acc;
};

class BitstreamReader {
    constructor() {
        this.buffers = [];
        this.bufferedLength = 0;
        this._offset = 0;
        this.skippedLength = 0;
    }
    get available() { return this.bufferedLength - this.skippedLength; }
    get offset() { return this._offset; }
    getBit(offset) {
        const byte = this.buffers[0][offset >> 3];
        return +!!(byte & (1 << (offset & 7)));
    }
    readSync(length) {
        let value = 0;
        if (this._offset >> 3 > this.buffers[0].byteLength) throw 'Out of data';
        for (let i = length - 1; i >= 0; --i) {
            value = value * 2 + this.getBit(this._offset + i);
        }
        this._offset += length;
        this.bufferedLength -= length;
        return value;
    }
    addBuffer(buffer) {
        this.buffers.push(buffer);
        this.bufferedLength += buffer.length * 8;
    }
}

class BitstreamWriter {
    constructor(stream, bufferSize = 1) {
        this.stream = stream;
        this.buffer = new Uint8Array(1);
        this.pendingBits = 0;
        this.bufferoffset = 0;
        this._offset = 0;
    }
    get offset() { return this._offset; }
    end() { if (this.bufferoffset > 0) this.flush(); }
    flush() {
        this.stream.write(new Uint8Array(this.buffer));
        this.bufferoffset = 0;
        this.buffer.fill(0);
    }
    setBit(b) {
        let byte = this.buffer[0];
        byte |= b << (this._offset & 7);
        this.buffer[0] = byte;
        this._offset += 1;
        if (++this.bufferoffset === this.buffer.length * 8) this.flush();
    }
    write(length, value) {
        while (length--) {
            this.setBit(value & 1);
            value >>= 1;
        }
    }
}

const TINF_OK = 0;

class Tree {
    constructor() {
        this.table = new Uint16Array(16);
        this.trans = new Uint16Array(288);
    }
}

const getPathTo = (tree, value) => {
    if (tree[0] === value) return '0';
    if (tree[1] === value) return '1';
    let p;
    if (typeof tree[0] !== 'number') p = getPathTo(tree[0], value);
    let b = '0';
    if (!p) {
        if (tree[1] && typeof tree[1] !== 'number') p = getPathTo(tree[1], value);
        b = '1';
    }
    if (p) return b + p;
};

function buildHuffmanTable(codeLengths, values) {
    let k = 0, code = [], i, j, length = 16;
    while (length > 0 && !codeLengths[length - 1]) length--;
    code.push({ children: [], index: 0 });
    let p = code[0], q;
    for (i = 0; i < length; i++) {
        for (j = 0; j < codeLengths[i]; j++) {
            p = code.pop();
            p.children[p.index] = values[k];
            while (p.index > 0) {
                if (code.length === 0) throw new Error('Could not recreate Huffman Table');
                p = code.pop();
            }
            p.index++;
            code.push(p);
            while (code.length <= i) {
                code.push((q = { children: [], index: 0 }));
                p.children[p.index] = q.children;
                p = q;
            }
            k++;
        }
        if (i + 1 < length) {
            code.push((q = { children: [], index: 0 }));
            p.children[p.index] = q.children;
            p = q;
        }
    }
    return code[0].children;
}

class DeflateData {
    constructor(source, dests, to_hide, hidden) {
        this.source = source;
        this.dests = dests;
        this.to_hide = to_hide;
        this.hidden = hidden;
        this.ltree = new Tree();
        this.dtree = new Tree();
        this.pathMap = new Map();
        this.dest = [];
    }
    computeReverse() {
        this.rltree = buildHuffmanTable(this.ltree.table, this.ltree.trans)[0];
        this.rdtree = buildHuffmanTable(this.dtree.table, this.dtree.trans)[0];
        this.adists = new Set(this.rdtree.flat(16));
    }
}

const sltree = new Tree();
const sdtree = new Tree();
let rltree;
let rdtree;
let sadist;
const length_bits = new Uint8Array(30);
const length_base = new Uint16Array(30);
const dist_bits = new Uint8Array(30);
const dist_base = new Uint16Array(30);
const clcidx = new Uint8Array([
    16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
]);
const code_tree = new Tree();
const lengths_buf = new Uint8Array(288 + 32);

function tinf_build_bits_base(bits, base, delta, first) {
    let i, sum;
    for (i = 0; i < delta; ++i) bits[i] = 0;
    for (i = 0; i < 30 - delta; ++i) bits[i + delta] = (i / delta) | 0;
    for (sum = first, i = 0; i < 30; ++i) {
        base[i] = sum;
        sum += 1 << bits[i];
    }
}

function tinf_build_fixed_trees(lt, dt) {
    let i;
    for (i = 0; i < 7; ++i) lt.table[i] = 0;
    lt.table[7] = 24;
    lt.table[8] = 152;
    lt.table[9] = 112;
    for (i = 0; i < 24; ++i) lt.trans[i] = 256 + i;
    for (i = 0; i < 144; ++i) lt.trans[24 + i] = i;
    for (i = 0; i < 8; ++i) lt.trans[24 + 144 + i] = 280 + i;
    for (i = 0; i < 112; ++i) lt.trans[24 + 144 + 8 + i] = 144 + i;
    for (i = 0; i < 5; ++i) dt.table[i] = 0;
    dt.table[5] = 32;
    for (i = 0; i < 32; ++i) dt.trans[i] = i;
}

const offs_buf = new Uint16Array(16);
function tinf_build_tree(t, lengths2, off, num) {
    let i, sum;
    for (i = 0; i < 16; ++i) t.table[i] = 0;
    for (i = 0; i < num; ++i) t.table[lengths2[off + i]]++;
    t.table[0] = 0;
    for (sum = 0, i = 0; i < 16; ++i) {
        offs_buf[i] = sum;
        sum += t.table[i];
    }
    for (i = 0; i < num; ++i) {
        if (lengths2[off + i]) t.trans[offs_buf[lengths2[off + i]]++] = i;
    }
}

function tinf_getbit(d) { return d.source.readSync(1); }

let loff_global = 0;
const loffs_global = [];
function tinf_read_bits(d, num, base) {
    if (!num) return base;
    const v = d.source.readSync(num) + base;
    loff_global = v;
    loffs_global.push(v);
    if (loffs_global.length > 4) loffs_global.shift();
    return v;
}

function tinf_decode_symbol(d, t, copy = true, ext = {}) {
    let sum = 0, cur = 0, len = 0, s = 0;
    do {
        const b = d.source.readSync(1);
        copy && d.hidden && d.hidden.write(1, b);
        s = (s << 1) | b;
        cur = 2 * cur + b;
        ++len;
        sum += t.table[len];
        cur -= t.table[len];
    } while (cur >= 0);
    ext.length = len;
    ext.sym = s;
    return t.trans[sum + cur];
}

function tinf_decode_trees(d, lt, dt, copy = true) {
    let i, num, length;
    const hlit = tinf_read_bits(d, 5, 257);
    copy && d.hidden && d.hidden.write(5, hlit - 257);
    const hdist = tinf_read_bits(d, 5, 1);
    copy && d.hidden && d.hidden.write(5, hdist - 1);
    const hclen = tinf_read_bits(d, 4, 4);
    copy && d.hidden && d.hidden.write(4, hclen - 4);
    for (i = 0; i < 19; ++i) lengths_buf[i] = 0;
    for (i = 0; i < hclen; ++i) {
        const clen = tinf_read_bits(d, 3, 0);
        copy && d.hidden && d.hidden.write(3, clen);
        lengths_buf[clcidx[i]] = clen;
    }
    tinf_build_tree(code_tree, lengths_buf, 0, 19);
    for (num = 0; num < hlit + hdist;) {
        const sym = tinf_decode_symbol(d, code_tree, copy);
        let prev;
        switch (sym) {
            case 16:
                prev = lengths_buf[num - 1];
                length = tinf_read_bits(d, 2, 3);
                copy && d.hidden && d.hidden.write(2, length - 3);
                for (; length; --length) lengths_buf[num++] = prev;
                break;
            case 17:
                length = tinf_read_bits(d, 3, 3);
                copy && d.hidden && d.hidden.write(3, length - 3);
                for (; length; --length) lengths_buf[num++] = 0;
                break;
            case 18:
                length = tinf_read_bits(d, 7, 11);
                copy && d.hidden && d.hidden.write(7, length - 11);
                for (; length; --length) lengths_buf[num++] = 0;
                break;
            default:
                lengths_buf[num++] = sym;
                break;
        }
    }
    tinf_build_tree(lt, lengths_buf, 0, hlit);
    tinf_build_tree(dt, lengths_buf, hlit, hdist);
}

const get_symbol = (value, bits_table, base_table) => {
    let i = 0;
    for (i = 0; i < base_table.length; ++i) {
        if (base_table[i] > value) {
            i--;
            return [i, bits_table[i], value - base_table[i]];
        }
    }
    i--;
    return [i, bits_table[i], value - base_table[i]];
};

const encode_symbol = (sym, tree, _pathMap) => {
    const code = getPathTo(tree, sym);
    return { length: code ? code.length : undefined, val: parseInt(code, 2) };
};

let dh_capacity = 0;

function tinf_inflate_block_data(d, lt, dt) {
    while (1) {
        let sym = tinf_decode_symbol(d, lt);
        if (sym === 256) return TINF_OK;
        if (sym < 256) {
            d.dest.push(sym);
        } else {
            sym -= 257;
            const length = tinf_read_bits(d, length_bits[sym], length_base[sym]);
            if (length_bits[sym] && d.hidden) d.hidden.write(length_bits[sym], length - length_base[sym]);
            const ext = { length: 0, sym: 0 };
            const dist = tinf_decode_symbol(d, dt, false, ext);
            let backoffset = tinf_read_bits(d, dist_bits[dist], dist_base[dist]);
            const offs2 = d.dest.length - backoffset;

            const skip =
                !d.to_hide ||
                (d.to_hide && d.to_hide instanceof BitstreamReader && d.to_hide.available === 0);

            const matchArr = new Uint8Array(d.dest.slice(offs2, offs2 + length));
            if (!skip && matchArr.length === length) {
                let begin = d.dest.length - 32768;
                if (begin < 0) begin = 0;
                let matches = [];
                let o = 0;
                const slic = new Uint8Array(d.dest.slice(begin + o, d.dest.length));
                while (begin + o < d.dest.length) {
                    const r = bufIndexOf(slic, matchArr, o);
                    if (r >= 0) {
                        matches.push(r + begin);
                        o = r + 1;
                    } else {
                        break;
                    }
                }
                if (matches.length > 1) {
                    matches = matches
                        .map((e) => -(e - d.dest.length))
                        .filter((e) => {
                            const [dsym2] = get_symbol(e, dist_bits, dist_base);
                            return d.adists.has(dsym2);
                        });
                    matches.reverse();
                    const v = Math.floor(Math.log2(matches.length));
                    dh_capacity += v;
                    if (d.to_hide instanceof BitstreamReader) {
                        if (d.to_hide.available) {
                            const s = d.to_hide.readSync(Math.min(d.to_hide.available, v));
                            backoffset = matches[s];
                        }
                    } else {
                        const idx = matches.indexOf(backoffset);
                        d.to_hide.write(v, idx);
                    }
                }
            }
            const [dsym, dlen, doff] = get_symbol(backoffset, dist_bits, dist_base);
            const encdist = encode_symbol(dsym, d.rdtree, d.pathMap);
            d.hidden && d.hidden.write(encdist.length, revbyte(encdist.val, encdist.length));
            d.hidden && d.hidden.write(dlen, doff);
            for (let i = offs2; i < offs2 + length; ++i) d.dest.push(d.dest[i]);
        }
    }
}

function tinf_inflate_uncompressed_block(d) {
    if (d.source.offset & 7) d.source.readSync((8 - d.source.offset) & 7);
    if (d.hidden && d.hidden.offset & 7) d.hidden.write((8 - d.hidden.offset) & 7, 0);
    const length = d.source.readSync(16);
    d.hidden && d.hidden.write(16, length);
    const invlength = d.source.readSync(16);
    d.hidden && d.hidden.write(16, invlength);
    if (length !== (~invlength & 65535)) return -4;
    for (let i = length; i; --i) {
        const v = d.source.readSync(8);
        d.dest.push(v);
        d.hidden && d.hidden.write(8, v);
    }
    return TINF_OK;
}

function tinf_uncompress(source, decompressed, to_hide, hiddenCb) {
    const decomp = decompressed ? new BitstreamWriter({ write: decompressed }) : null;
    const hid = hiddenCb && new BitstreamWriter({ write: hiddenCb }, 4);
    const d = new DeflateData(source, decomp, to_hide, hid);
    let res, bfinal, btype;
    do {
        bfinal = tinf_getbit(d);
        d.hidden && d.hidden.write(1, bfinal);
        btype = tinf_read_bits(d, 2, 0);
        d.hidden && d.hidden.write(2, btype);
        switch (btype) {
            case 0:
                res = tinf_inflate_uncompressed_block(d);
                break;
            case 1:
                d.rdtree = rdtree;
                d.rltree = rltree;
                d.adists = sadist;
                res = tinf_inflate_block_data(d, sltree, sdtree);
                break;
            case 2:
                tinf_decode_trees(d, d.ltree, d.dtree);
                d.computeReverse();
                res = tinf_inflate_block_data(d, d.ltree, d.dtree);
                break;
            default:
                res = -2;
        }
        if (res !== TINF_OK) throw new Error('Data error ' + res);
    } while (!bfinal);
    decomp && decomp.end();
    hid && hid.end();
}

tinf_build_fixed_trees(sltree, sdtree);
tinf_build_bits_base(length_bits, length_base, 4, 3);
tinf_build_bits_base(dist_bits, dist_base, 2, 1);
rltree = buildHuffmanTable(sltree.table, sltree.trans)[0];
rdtree = buildHuffmanTable(sdtree.table, sdtree.trans)[0];
sadist = new Set(rdtree.flat(16));
length_bits[28] = 0;
length_base[28] = 258;

const embedInRawDeflate = (deflateBody, hiddenBytes) => {
    const src = new BitstreamReader();
    const hid = new BitstreamReader();
    hid.addBuffer(hiddenBytes);
    src.addBuffer(deflateBody);
    const chunks = [];
    tinf_uncompress(src, undefined, hid, (c) => chunks.push(new Uint8Array(c)));

    const embeddedBits = hiddenBytes.length * 8 - hid.available;
    return { body: concatBytes(chunks), embeddedBits: embeddedBits };
};

const PNG_EMBED_MAGIC_0 = 0x4A;
const PNG_EMBED_MAGIC_1 = 0x50;
const PNG_EMBED_MAGIC_2 = 0x45;
const PNG_EMBED_MAGIC_3 = 0x31;

const extractFromRawDeflate = (deflateBody) => {
    const src = new BitstreamReader();
    src.addBuffer(deflateBody);
    const chnks = [];
    let targetLen = 0;
    const sink = new BitstreamWriter({
        write(chunk) {
            for (const i of chunk) {
                chnks.push(i);

                if (chnks.length === 4) {
                    if (chnks[0] !== PNG_EMBED_MAGIC_0
                        || chnks[1] !== PNG_EMBED_MAGIC_1
                        || chnks[2] !== PNG_EMBED_MAGIC_2
                        || chnks[3] !== PNG_EMBED_MAGIC_3) {
                        throw 'Finish';
                    }
                }

                if (chnks.length === 6) {
                    const len = chnks[4] | (chnks[5] << 8);
                    if (len === 0 || len > 65535) throw 'Finish';
                    targetLen = 6 + len;
                }
                if (targetLen > 0 && chnks.length >= targetLen) throw 'Finish';
            }
        },
    });
    try {
        tinf_uncompress(src, undefined, sink, undefined);
    } catch (e) {
        if (e === 'Finish') return chnks.length ? new Uint8Array(chnks) : null;

    }
    return chnks.length ? new Uint8Array(chnks) : null;
};

const _jpeNormalizeItems = (items) => items.map(function (it) {
    if (typeof it === 'string') return { kind: 'url', value: it };
    return it;
});

const JPE_ENC_MAGIC = new Uint8Array([0x4D, 0x47, 0x43, 0x01]);

function _jpeBytesStartWith(haystack, needle) {
    if (!haystack || haystack.length < needle.length) return false;
    for (let i = 0; i < needle.length; i++) if (haystack[i] !== needle[i]) return false;
    return true;
}

async function _jpeEncryptPayload(plainBytes) {
    const key = crypto.getRandomValues(new Uint8Array(16));
    const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'AES-CTR' }, false, ['encrypt']);
    const cipherBuf = await crypto.subtle.encrypt(
        { name: 'AES-CTR', counter: new Uint8Array(16), length: 64 },
        cryptoKey,
        plainBytes
    );
    const cipher = new Uint8Array(cipherBuf);
    const out = new Uint8Array(JPE_ENC_MAGIC.length + 16 + cipher.length);
    out.set(JPE_ENC_MAGIC, 0);
    out.set(key, JPE_ENC_MAGIC.length);
    out.set(cipher, JPE_ENC_MAGIC.length + 16);
    return out;
}

async function _jpeDecryptPayload(envelope) {
    if (!_jpeBytesStartWith(envelope, JPE_ENC_MAGIC)) return null;
    if (envelope.length < JPE_ENC_MAGIC.length + 16) return null;
    const key = envelope.slice(JPE_ENC_MAGIC.length, JPE_ENC_MAGIC.length + 16);
    const cipher = envelope.slice(JPE_ENC_MAGIC.length + 16);
    try {
        const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'AES-CTR' }, false, ['decrypt']);
        const plainBuf = await crypto.subtle.decrypt(
            { name: 'AES-CTR', counter: new Uint8Array(16), length: 64 },
            cryptoKey,
            cipher
        );
        return new Uint8Array(plainBuf);
    } catch (e) { return null; }
}

function _jpeBytesToHex(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
    return s;
}
function _jpeHexToBytes(hex) {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
}

async function _jpeEncryptHiddenFile(srcFile) {
    const fileKey = crypto.getRandomValues(new Uint8Array(16));
    const cryptoKey = await crypto.subtle.importKey('raw', fileKey, { name: 'AES-CTR' }, false, ['encrypt']);
    const buf = await srcFile.arrayBuffer();
    const cipherBuf = await crypto.subtle.encrypt(
        { name: 'AES-CTR', counter: new Uint8Array(16), length: 64 },
        cryptoKey,
        buf
    );
    const cipherBytes = new Uint8Array(cipherBuf);

    const randName = _jpeRandomFilenameFor(srcFile);
    const encBlob = new Blob([cipherBytes], { type: 'application/octet-stream' });
    let wrapped;
    try {
        wrapped = new File([encBlob], randName, { type: 'application/octet-stream' });
    } catch (e) {

        wrapped = encBlob;
        try { wrapped.name = randName; } catch (_) {}
    }
    return { encryptedFile: wrapped, fileKey };
}

async function _jpeDecryptArrayBuffer(arrayBuf, fileKey) {
    const cryptoKey = await crypto.subtle.importKey('raw', fileKey, { name: 'AES-CTR' }, false, ['decrypt']);
    const plainBuf = await crypto.subtle.decrypt(
        { name: 'AES-CTR', counter: new Uint8Array(16), length: 64 },
        cryptoKey,
        arrayBuf
    );
    return new Uint8Array(plainBuf);
}

const encodeUrlList = async (items) => {
    const norm = _jpeNormalizeItems(items);
    const toks = norm.map(function (it) {
        if (it.kind === 'text') {
            return 'T' + encodeURIComponent(it.value);
        }

        if (it.kind === 'encUrl' && it.fileKey) {
            try {
                const url = new URL(it.value);
                if (!(url.host in URL_PREFIXES)) return null;
                return 'E' + _jpeBytesToHex(it.fileKey) + URL_PREFIXES[url.host] + url.pathname.slice(1);
            } catch { return null; }
        }
        try {
            const url = new URL(it.value);
            if (!(url.host in URL_PREFIXES)) return null;
            return URL_PREFIXES[url.host] + url.pathname.slice(1);
        } catch { return null; }
    }).filter(function (s) { return s; });
    const plain = bytesFromString(toks.join(' '));

    return await _jpeEncryptPayload(plain);
};

const JPE_URL_PATH_RE = /^[a-z0-9]{4,40}\.[a-z0-9]{2,5}$/i;

const JPE_WAIFU_PATH_RE = /^f\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(?:\.[a-z0-9]{2,5})?$/i;
const JPE_TEXT_MIN_PRINTABLE_RATIO = 0.85;

const decodeUrlList = async (bytes) => {

    let working = bytes;
    if (_jpeBytesStartWith(bytes, JPE_ENC_MAGIC)) {
        const decrypted = await _jpeDecryptPayload(bytes);
        if (!decrypted) return [];
        working = decrypted;
    }
    const s = stringFromBytes(working).trim();
    if (!s) return [];
    return s.split(' ').map(function (tok) {
        if (!tok) return null;
        const c = tok[0];
        if (c === 'T') {
            try {
                var text = decodeURIComponent(tok.slice(1));

                if (!text) return null;
                var printable = 0;
                for (var i = 0; i < text.length; i++) {
                    var cc = text.charCodeAt(i);
                    if ((cc >= 0x20 && cc < 0x7F) || cc === 0x09 || cc === 0x0A || cc === 0x0D || cc >= 0xA0) printable++;
                }
                if (printable / text.length < JPE_TEXT_MIN_PRINTABLE_RATIO) return null;
                return { kind: 'text', value: text };
            } catch (e) { return null; }
        }

        if (c === 'E') {
            if (tok.length < 34) return null;
            var keyHex = tok.slice(1, 33);
            if (!/^[0-9a-f]{32}$/i.test(keyHex)) return null;
            var fileKey = _jpeHexToBytes(keyHex);
            var urlPart = tok.slice(33);
            if (!urlPart) return null;
            var encHost = REVERSE_PREFIXES[urlPart[0]];
            if (!encHost) return null;
            var encPath = urlPart.slice(1);
            var encPathOk = (encHost === 'waifuvault.moe')
                ? JPE_WAIFU_PATH_RE.test(encPath)
                : JPE_URL_PATH_RE.test(encPath);
            if (!encPathOk) return null;
            var encUrl = 'https://' + encHost + '/' + encPath;
            try {
                var encU = new URL(encUrl);
                if (!ALLOWED_HOSTS.includes(encU.host)) return null;
                return { kind: 'encUrl', value: encUrl, fileKey: fileKey };
            } catch { return null; }
        }
        const host = REVERSE_PREFIXES[c];
        if (!host) return null;
        var path = tok.slice(1);

        var pathOk = (host === 'waifuvault.moe')
            ? JPE_WAIFU_PATH_RE.test(path)
            : JPE_URL_PATH_RE.test(path);
        if (!pathOk) return null;
        const url = 'https://' + host + '/' + path;
        try {
            const u = new URL(url);
            if (!ALLOWED_HOSTS.includes(u.host)) return null;
            return { kind: 'url', value: url };
        } catch { return null; }
    }).filter(function (x) { return x; });
};

async function _pngRecompressIdat(idatComp) {
    if (typeof DecompressionStream === 'undefined' || typeof CompressionStream === 'undefined') return null;
    try {
        const decompStream = new DecompressionStream('deflate');
        const decompResp = new Response(new Blob([idatComp]).stream().pipeThrough(decompStream));
        const decompressedBuf = await decompResp.arrayBuffer();
        const compStream = new CompressionStream('deflate');
        const compResp = new Response(new Blob([new Uint8Array(decompressedBuf)]).stream().pipeThrough(compStream));
        const recompressedBuf = await compResp.arrayBuffer();
        return new Uint8Array(recompressedBuf);
    } catch (e) {
        return null;
    }
}

const jpeEmbedPng = async (pngBytes, items) => {
    const payload = await encodeUrlList(items);
    if (payload.length === 0) throw new Error('No embeddable items');

    if (payload.length > 65535) throw new Error('Payload too large for PNG embed (' + payload.length + ' bytes, max 65535)');
    const hidden = new Uint8Array(6 + payload.length);
    hidden[0] = PNG_EMBED_MAGIC_0;
    hidden[1] = PNG_EMBED_MAGIC_1;
    hidden[2] = PNG_EMBED_MAGIC_2;
    hidden[3] = PNG_EMBED_MAGIC_3;
    hidden[4] = payload.length & 0xFF;
    hidden[5] = (payload.length >>> 8) & 0xFF;
    hidden.set(payload, 6);

    const chunks = [];
    const idatParts = [];
    for (const ch of pngChunks(pngBytes)) {
        if (ch.name === 'IDAT') idatParts.push(ch.data);
        chunks.push({ name: ch.name, data: ch.data });
    }
    if (idatParts.length === 0) throw new Error('PNG has no IDAT chunks');

    const comp = concatBytes(idatParts);
    if (comp.length < 6) throw new Error('IDAT too short');
    const head = comp.subarray(0, 2);
    const chksum = comp.subarray(comp.length - 4);
    const body = comp.subarray(2, comp.length - 4);

    let embedResult = embedInRawDeflate(body, hidden);
    let chosenHead = head, chosenChksum = chksum;
    let recompressed = false;
    if (embedResult.embeddedBits < hidden.length * 8) {
        try {
            const recompComp = await _pngRecompressIdat(comp);
            if (recompComp && recompComp.length >= 6) {
                const reHead   = recompComp.subarray(0, 2);
                const reChksum = recompComp.subarray(recompComp.length - 4);
                const reBody   = recompComp.subarray(2, recompComp.length - 4);
                const retry = embedInRawDeflate(reBody, hidden);
                if (retry.embeddedBits >= hidden.length * 8) {
                    embedResult = retry;
                    chosenHead = reHead;
                    chosenChksum = reChksum;
                    recompressed = true;
                }
            }
        } catch (e) {  }
    }
    if (embedResult.embeddedBits < hidden.length * 8) {
        var availableBytes = Math.floor(embedResult.embeddedBits / 8);
        throw new Error(
            'PNG base has only ~' + availableBytes + ' bytes of embed capacity ' +
            'even after recompression, but the payload needs ' + hidden.length +
            ' bytes. Try a much larger PNG or use a JPG base instead.'
        );
    }
    if (recompressed) jpeLog('PNG IDAT recompressed for embed slack (visual content unchanged)');
    const newBody = embedResult.body;
    const newIdat = concatBytes([chosenHead, newBody, chosenChksum]);

    let inserted = false;
    const out = [];
    for (const ch of chunks) {
        if (ch.name === 'IDAT') {
            if (!inserted) {
                out.push({ name: 'IDAT', data: newIdat });
                inserted = true;
            }
        } else {
            out.push(ch);
        }
    }
    return buildPng(out);
};

const jpeExtractPng = async (pngBytes) => {
    let idatParts = [];
    try {
        for (const ch of pngChunks(pngBytes)) {
            if (ch.name === 'IDAT') idatParts.push(ch.data);
            if (ch.name === 'IEND') break;
        }
    } catch (e) {
        return [];
    }
    if (idatParts.length === 0) return [];
    const comp = concatBytes(idatParts);
    if (comp.length < 6) return [];
    const body = comp.subarray(2, comp.length - 4);
    let extracted;
    try {
        extracted = extractFromRawDeflate(body);
    } catch (e) {
        return [];
    }
    if (!extracted || extracted.length < 6) return [];

    if (extracted[0] !== PNG_EMBED_MAGIC_0
        || extracted[1] !== PNG_EMBED_MAGIC_1
        || extracted[2] !== PNG_EMBED_MAGIC_2
        || extracted[3] !== PNG_EMBED_MAGIC_3) return [];
    const len = extracted[4] | (extracted[5] << 8);
    if (len === 0 || len > extracted.length - 6) return [];
    const payload = extracted.subarray(6, 6 + len);
    return await decodeUrlList(payload);
};

const JPE_TRAILER_MARKER = 'JPEMBED';
const JPE_TRAILER_LEN_DIGITS = 5;

const jpeEmbedTrailer = async (carrierBytes, items) => {
    const payload = await encodeUrlList(items);
    if (payload.length === 0) throw new Error('No embeddable items');
    if (payload.length > Math.pow(10, JPE_TRAILER_LEN_DIGITS) - 1) {
        throw new Error('Payload too long for trailer (max ' + (Math.pow(10, JPE_TRAILER_LEN_DIGITS) - 1) + ' bytes)');
    }
    let lenStr = payload.length.toString();
    while (lenStr.length < JPE_TRAILER_LEN_DIGITS) lenStr = '0' + lenStr;
    return concatBytes([carrierBytes, payload, bytesFromString(lenStr), bytesFromString(JPE_TRAILER_MARKER)]);
};

const jpeExtractTrailer = async (bytes) => {
    const markerLen = JPE_TRAILER_MARKER.length;
    const headerLen = markerLen + JPE_TRAILER_LEN_DIGITS;
    if (bytes.length < headerLen + 1) return [];
    const tail = bytes.subarray(bytes.length - markerLen);
    if (stringFromBytes(tail) !== JPE_TRAILER_MARKER) return [];
    const lenStr = stringFromBytes(bytes.subarray(bytes.length - headerLen, bytes.length - markerLen));
    const len = parseInt(lenStr, 10);
    if (isNaN(len) || len <= 0 || len > bytes.length - headerLen) return [];
    const payload = bytes.subarray(bytes.length - headerLen - len, bytes.length - headerLen);
    return await decodeUrlList(payload);
};

function* f5get() {
  let extrBit = 0;
  let k = 0;
  for (let i = 0; i < 4; ++i) {
    const b2 = yield;
    k |= b2 << i;
  }
  k = (k & 15) + 1;
  let toread = 8;
  let len = 0;
  while (toread--) {
    const b2 = yield;
    len = len * 2 + b2;
  }
  const b = yield;
  toread += 8;
  if (b) toread += 7;
  else len *= 2;
  while (toread--) {
    const b2 = yield;
    len = len * 2 + b2;
  }
  const rlen = revbyte(len, b ? 23 : 16);
  len = rlen;
  if (len > 256) throw new Error("Too big for Smash");
  len *= 8;
  const chunks = [];
  const bw = new BitstreamWriter({
    write(chunk) {
      chunks.push(chunk);
    },
  });
  while (len) {
    extrBit = yield;
    bw.write(1, extrBit);
    len--;
  }
  bw.end();
  return concatBytes(chunks).slice(0, rlen);
}
var bitcode = new Array(65535);
var category = new Array(65535);
var std_dc_luminance_nrcodes = [
  0, 0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0,
];
var std_dc_luminance_values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
var std_ac_luminance_nrcodes = [
  0, 0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 125,
];
var std_ac_luminance_values = [
  1, 2, 3, 0, 4, 17, 5, 18, 33, 49, 65, 6, 19, 81, 97, 7, 34, 113, 20, 50,
  129, 145, 161, 8, 35, 66, 177, 193, 21, 82, 209, 240, 36, 51, 98, 114, 130,
  9, 10, 22, 23, 24, 25, 26, 37, 38, 39, 40, 41, 42, 52, 53, 54, 55, 56, 57,
  58, 67, 68, 69, 70, 71, 72, 73, 74, 83, 84, 85, 86, 87, 88, 89, 90, 99, 100,
  101, 102, 103, 104, 105, 106, 115, 116, 117, 118, 119, 120, 121, 122, 131,
  132, 133, 134, 135, 136, 137, 138, 146, 147, 148, 149, 150, 151, 152, 153,
  154, 162, 163, 164, 165, 166, 167, 168, 169, 170, 178, 179, 180, 181, 182,
  183, 184, 185, 186, 194, 195, 196, 197, 198, 199, 200, 201, 202, 210, 211,
  212, 213, 214, 215, 216, 217, 218, 225, 226, 227, 228, 229, 230, 231, 232,
  233, 234, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250,
];
var std_dc_chrominance_nrcodes = [
  0, 0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0,
];
var std_dc_chrominance_values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
var std_ac_chrominance_nrcodes = [
  0, 0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 119,
];
var std_ac_chrominance_values = [
  0, 1, 2, 3, 17, 4, 5, 33, 49, 6, 18, 65, 81, 7, 97, 113, 19, 34, 50, 129, 8,
  20, 66, 145, 161, 177, 193, 9, 35, 51, 82, 240, 21, 98, 114, 209, 10, 22,
  36, 52, 225, 37, 241, 23, 24, 25, 26, 38, 39, 40, 41, 42, 53, 54, 55, 56,
  57, 58, 67, 68, 69, 70, 71, 72, 73, 74, 83, 84, 85, 86, 87, 88, 89, 90, 99,
  100, 101, 102, 103, 104, 105, 106, 115, 116, 117, 118, 119, 120, 121, 122,
  130, 131, 132, 133, 134, 135, 136, 137, 138, 146, 147, 148, 149, 150, 151,
  152, 153, 154, 162, 163, 164, 165, 166, 167, 168, 169, 170, 178, 179, 180,
  181, 182, 183, 184, 185, 186, 194, 195, 196, 197, 198, 199, 200, 201, 202,
  210, 211, 212, 213, 214, 215, 216, 217, 218, 226, 227, 228, 229, 230, 231,
  232, 233, 234, 242, 243, 244, 245, 246, 247, 248, 249, 250,
];
function _initCategoryNumber() {
  let nrlower = 1;
  let nrupper = 2;
  for (let cat = 1; cat <= 15; cat++) {
    for (let nr = nrlower; nr < nrupper; nr++) {
      category[32767 + nr] = cat;
      bitcode[32767 + nr] = [];
      bitcode[32767 + nr][1] = cat;
      bitcode[32767 + nr][0] = nr;
    }
    for (let nrneg = -(nrupper - 1); nrneg <= -nrlower; nrneg++) {
      category[32767 + nrneg] = cat;
      bitcode[32767 + nrneg] = [];
      bitcode[32767 + nrneg][1] = cat;
      bitcode[32767 + nrneg][0] = nrupper - 1 + nrneg;
    }
    nrlower <<= 1;
    nrupper <<= 1;
  }
}
_initCategoryNumber();
function _computeHuffmanTbl(nrcodes, std_table) {
  let codevalue = 0;
  let pos_in_table = 0;
  const HT = [];
  for (let k = 1; k <= 16; k++) {
    for (let j = 1; j <= nrcodes[k]; j++) {
      HT[std_table[pos_in_table]] = [];
      HT[std_table[pos_in_table]][0] = codevalue;
      HT[std_table[pos_in_table]][1] = k;
      pos_in_table++;
      codevalue++;
    }
    codevalue *= 2;
  }
  return HT;
}
var YDC_HT = _computeHuffmanTbl(
  std_dc_luminance_nrcodes,
  std_dc_luminance_values
);
var UVDC_HT = _computeHuffmanTbl(
  std_dc_chrominance_nrcodes,
  std_dc_chrominance_values
);
var YAC_HT = _computeHuffmanTbl(
  std_ac_luminance_nrcodes,
  std_ac_luminance_values
);
var UVAC_HT = _computeHuffmanTbl(
  std_ac_chrominance_nrcodes,
  std_ac_chrominance_values
);
var f5stego = class {
  constructor(key2, maxPixels = 4096 * 4096) {
    this.maxPixels = maxPixels;
  }
  embed(image, data, k) {

    this.gengen = null;
    this.parse(image);
    this.f5put(data, k);
    return this.pack();
  }
  extract(image) {
    try {
      this.gengen = f5get();
      this.gengen.next();
      this.parse(image, true);
      return this.f5get();
    } catch (e) {
      if (e instanceof Uint8Array) return e;
      throw e;
    }
  }
  #_raw;
  #jfif;
  #APPn;
  #qts;
  #frame = null;
  #tail = null;
  #_f5write(coeff, data, k) {
    const coeff_count = coeff.length;
    let _changed = 0,
      _embedded = 0,
      _examined = 0,
      _thrown = 0,
      shuffled_index = 0,
      i,
      n,
      ii;
    let next_bit_to_embed = 0,
      byte_to_embed = data.length,
      data_idx = 0,
      available_bits_to_embed = 0;
    n = (1 << k) - 1;
    byte_to_embed = k - 1;
    byte_to_embed ^= 0;
    next_bit_to_embed = byte_to_embed & 1;
    byte_to_embed >>= 1;
    available_bits_to_embed = 3;
    for (ii = 0; ii < coeff_count; ii++) {
      shuffled_index = ii;
      if (shuffled_index % 64 === 0 || coeff[shuffled_index] === 0) continue;
      const cc = coeff[shuffled_index];
      _examined++;
      if (cc > 0 && (cc & 1) != next_bit_to_embed) {
        coeff[shuffled_index]--;
        _changed++;
      } else if (cc < 0 && (cc & 1) == next_bit_to_embed) {
        coeff[shuffled_index]++;
        _changed++;
      }
      if (coeff[shuffled_index] !== 0) {
        _embedded++;
        if (available_bits_to_embed === 0) {
          if (k != 1 || data_idx >= data.length) break;
          byte_to_embed = data[data_idx++];
          byte_to_embed ^= 0;
          available_bits_to_embed = 8;
        }
        next_bit_to_embed = byte_to_embed & 1;
        byte_to_embed >>= 1;
        available_bits_to_embed--;
      } else {
        _thrown++;
      }
    }
    if (k == 1 && _embedded < data.length * 8)
      throw "capacity exceeded " + _embedded / 8 + " " + data.length;
    if (k != 1) {
      let is_last_byte = false,
        k_bits_to_embed = 0;
      while (
        !is_last_byte ||
        (available_bits_to_embed !== 0 && is_last_byte)
      ) {
        k_bits_to_embed = 0;
        for (i = 0; i < k; i++) {
          if (available_bits_to_embed === 0) {
            if (data_idx >= data.length) {
              is_last_byte = true;
              break;
            }
            byte_to_embed = data[data_idx++];
            byte_to_embed ^= 0;
            available_bits_to_embed = 8;
          }
          next_bit_to_embed = byte_to_embed & 1;
          byte_to_embed >>= 1;
          available_bits_to_embed--;
          k_bits_to_embed |= next_bit_to_embed << i;
        }
        const code_word = [];
        let ci = null;
        for (i = 0; i < n; i++) {
          while (true) {
            if (++ii >= coeff_count) {
              throw "capacity exceeded " + _embedded / 8;
            }
            ci = ii;
            if (ci % 64 !== 0 && coeff[ci] !== 0) break;
          }
          code_word.push(ci);
        }
        _examined += n;
        while (true) {
          var vhash = 0,
            extracted_bit;
          for (i = 0; i < code_word.length; i++) {
            if (coeff[code_word[i]] > 0) {
              extracted_bit = coeff[code_word[i]] & 1;
            } else {
              extracted_bit = 1 - (coeff[code_word[i]] & 1);
            }
            if (extracted_bit == 1) vhash ^= i + 1;
          }
          i = vhash ^ k_bits_to_embed;
          if (!i) {
            _embedded += k;
            break;
          }
          i--;
          coeff[code_word[i]] += coeff[code_word[i]] < 0 ? 1 : -1;
          _changed++;
          if (coeff[code_word[i]] === 0) {
            _thrown++;
            code_word.splice(i, 1);
            while (true) {
              if (++ii >= coeff_count) {
                throw "capacity exceeded " + _embedded / 8;
              }
              ci = ii;
              if (ci % 64 !== 0 && coeff[ci] !== 0) break;
            }
            _examined++;
            code_word.push(ci);
          } else {
            _embedded += k;
            break;
          }
        }
      }
    }
    return {
      k: k,
      embedded: _embedded / 8,
      examined: _examined,
      changed: _changed,
      thrown: _thrown,
      efficiency: (_embedded / _changed).toFixed(2),
    };
  }
  f5put(data, k) {
    if (!this.#frame) throw "Parser not run";
    let t,
      i,
      comp = this.#frame.components[0];
    if (data.length > 8388607)
      throw "Data too big. Max 8388607 bytes allowed.";
    if (data.length < 32768) {
      t = new Uint8Array(2 + data.length);
      t[0] = data.length & 255;
      t[1] = data.length >>> 8;
      t.set(data, 2);
    } else {
      t = new Uint8Array(3 + data.length);
      t[0] = data.length & 255;
      t[1] = ((data.length >>> 8) & 127) + 128;
      t[2] = data.length >>> 15;
      t.set(data, 3);
    }
    if (comp.componentId != 1) {
      for (i = 0; i < this.#frame.components.length; i++) {
        if (this.#frame.components[i].componentId == 1) {
          comp = this.#frame.components[i];
          break;
        }
      }
    }
    if (!("blocks" in comp)) {
      throw "Blocks failed to be parsed";
    }
    return this.#_f5write(comp.blocks, t, k);
  }
  f5get() {
    if (!this.#frame) throw "Parser not run";
    let comp = this.#frame.components[0];
    if (comp.componentId != 1) {
      for (let i = 0; i < this.#frame.components.length; i++) {
        if (this.#frame.components[i].componentId == 1) {
          comp = this.#frame.components[i];
          break;
        }
      }
    }
    if (!("blocks" in comp)) {
      throw "Blocks failed to be parsed";
    }
    const coeff = new Int16Array(comp.blocks.length);
    coeff.set(comp.blocks);
    let pos = -1,
      extrBit = 0,
      cCount = coeff.length - 1;
    let n,
      k = 0;
    let out = new Uint8Array((coeff.length / 8) | 0),
      extrByte = 0,
      outPos = 0,
      bitsAvail = 0,
      code = 0,
      hash2 = 0;
    while (bitsAvail < 4) {
      pos++;
      if (coeff[pos] === 0) {
        continue;
      }
      extrBit = coeff[pos] & 1;
      if (coeff[pos] < 0) {
        extrBit = 1 - extrBit;
      }
      k |= extrBit << bitsAvail;
      bitsAvail++;
    }
    k = (k & 15) + 1;
    n = (1 << k) - 1;
    bitsAvail = 0;
    if (k == 1) {
      while (pos < cCount) {
        pos++;
        if (coeff[pos] === 0) {
          continue;
        }
        extrBit = coeff[pos] & 1;
        if (coeff[pos] < 0) {
          extrBit = 1 - extrBit;
        }
        extrByte |= extrBit << bitsAvail;
        bitsAvail++;
        if (bitsAvail == 8) {
          out[outPos++] = extrByte;
          extrByte = 0;
          bitsAvail = 0;
        }
      }
    } else {
      while (pos < cCount) {
        pos++;
        if (coeff[pos] === 0) {
          continue;
        }
        extrBit = coeff[pos] & 1;
        if (coeff[pos] < 0) {
          extrBit = 1 - extrBit;
        }
        hash2 ^= extrBit * ++code;
        if (code == n) {
          extrByte |= hash2 << bitsAvail;
          bitsAvail += k;
          code = 0;
          hash2 = 0;
          while (bitsAvail >= 8) {
            out[outPos++] = extrByte & 255;
            bitsAvail -= 8;
            extrByte = extrByte >> 8;
          }
        }
      }
    }
    while (bitsAvail > 0) {
      out[outPos++] = extrByte & 255;
      bitsAvail -= 8;
      extrByte = extrByte >> 8;
    }
    let s = 2,
      l = out[0];
    if (out[1] & 128) {
      s++;
      l += ((out[1] & 127) << 8) + (out[2] << 15);
    } else {
      l += out[1] << 8;
    }
    return out.subarray(s, s + l);
  }
  gengen;
  parse(data, tolerant = false) {
    let offset = 0;
    function _buildHuffmanTable(nrcodes, values) {
      let codevalue = 0,
        pos_in_table = 0,
        HT = new Uint16Array(65536);
      for (let k = 0; k < 16; k++) {
        for (let j2 = 0; j2 < nrcodes[k]; j2++) {
          for (
            let i2 = codevalue << (15 - k),
              cntTo = (codevalue + 1) << (15 - k);
            i2 < cntTo;
            i2++
          ) {
            HT[i2] = values[pos_in_table] + ((k + 1) << 8);
          }
          pos_in_table++;
          codevalue++;
        }
        codevalue *= 2;
      }
      return HT;
    }
    const decodeScan = (
      data2,
      offset2,
      frame,
      components,
      resetInterval2,
      spectralStart,
      spectralEnd,
      successivePrev,
      successive
    ) => {
      let startOffset = offset2,
        bitsData = 0,
        bitsCount = 0,
        eobrun = 0,
        p1 = 1 << successive,
        m1 = -1 << successive;
      const prevpos = 0;
      const decodeBaseline = (component2, pos) => {
        while (bitsCount < 16) {
          bitsData = (bitsData << 8) + (data2[offset2] | 0);
          bitsCount += 8;
          if (data2[offset2] == 255) offset2++;
          offset2++;
        }
        let t =
          component2.huffmanTableDC[(bitsData >>> (bitsCount - 16)) & 65535];
        if (!t) throw "invalid huffman sequence";
        bitsCount -= t >>> 8;
        t &= 255;
        let diff = 0;
        if (t !== 0) {
          while (bitsCount < t) {
            bitsData = (bitsData << 8) + data2[offset2++];
            if ((bitsData & 255) == 255) offset2++;
            bitsCount += 8;
          }
          diff = (bitsData >>> (bitsCount - t)) & ((1 << t) - 1);
          bitsCount -= t;
          if (diff < 1 << (t - 1)) diff += (-1 << t) + 1;
        }
        component2.blocksDC[pos >> 6] = component2.pred += diff;
        let k2 = 1,
          s,
          r;
        while (k2 < 64) {
          while (bitsCount < 16) {
            bitsData = (bitsData << 8) + (data2[offset2] | 0);
            bitsCount += 8;
            if (data2[offset2] == 255) offset2++;
            offset2++;
          }
          s =
            component2.huffmanTableAC[
              (bitsData >>> (bitsCount - 16)) & 65535
            ];
          if (!s) throw "invalid huffman sequence";
          bitsCount -= s >>> 8;
          r = (s >> 4) & 15;
          s &= 15;
          if (s === 0) {
            if (r < 15) {
              break;
            }
            k2 += 16;
            continue;
          }
          k2 += r;
          while (bitsCount < s) {
            bitsData = (bitsData << 8) + data2[offset2++];
            if ((bitsData & 255) == 255) offset2++;
            bitsCount += 8;
          }
          component2.blocks[pos + k2] =
            (bitsData >>> (bitsCount - s)) & ((1 << s) - 1);
          if (component2.blocks[pos + k2] < 1 << (s - 1))
            component2.blocks[pos + k2] += (-1 << s) + 1;
          bitsCount -= s;
          k2++;
        }
      };
      function decodeDCFirst(component2, pos) {
        let diff = 0;
        while (bitsCount < 16) {
          bitsData = (bitsData << 8) + (data2[offset2] | 0);
          bitsCount += 8;
          if (data2[offset2] == 255) offset2++;
          offset2++;
        }
        let t =
          component2.huffmanTableDC[(bitsData >>> (bitsCount - 16)) & 65535];
        if (!t) throw "invalid huffman sequence";
        bitsCount -= t >>> 8;
        t &= 255;
        if (t !== 0) {
          while (bitsCount < t) {
            bitsData = (bitsData << 8) + data2[offset2++];
            if ((bitsData & 255) == 255) offset2++;
            bitsCount += 8;
          }
          diff = (bitsData >>> (bitsCount - t)) & ((1 << t) - 1);
          bitsCount -= t;
          if (diff < 1 << (t - 1)) diff += (-1 << t) + 1;
        }
        component2.blocksDC[pos >> 6] = component2.pred += diff << successive;
      }
      function decodeDCSuccessive(component2, pos) {
        if (!bitsCount) {
          bitsData = data2[offset2++];
          if (bitsData == 255) offset2++;
          bitsCount = 8;
        }
        component2.blocksDC[pos >> 6] |=
          ((bitsData >>> --bitsCount) & 1) << successive;
      }
      if (!frame) throw "Frame not parsed yet";
      function decodeACFirst(component2, pos) {
        if (eobrun > 0) {
          eobrun--;
          return;
        }
        let k2 = spectralStart,
          s,
          r;
        while (k2 <= spectralEnd) {
          while (bitsCount < 16) {
            bitsData = (bitsData << 8) + (data2[offset2] | 0);
            bitsCount += 8;
            if (data2[offset2] == 255) offset2++;
            offset2++;
          }
          s =
            component2.huffmanTableAC[
              (bitsData >>> (bitsCount - 16)) & 65535
            ];
          if (!s) throw "invalid huffman sequence";
          bitsCount -= s >>> 8;
          r = (s >> 4) & 15;
          s &= 15;
          if (s === 0) {
            if (r != 15) {
              eobrun = (1 << r) - 1;
              if (r) {
                while (bitsCount < r) {
                  bitsData = (bitsData << 8) + data2[offset2++];
                  if ((bitsData & 255) == 255) offset2++;
                  bitsCount += 8;
                }
                eobrun += (bitsData >>> (bitsCount - r)) & ((1 << r) - 1);
                bitsCount -= r;
              }
              break;
            }
            k2 += 16;
            continue;
          }
          k2 += r;
          while (bitsCount < s) {
            bitsData = (bitsData << 8) + data2[offset2++];
            if ((bitsData & 255) == 255) offset2++;
            bitsCount += 8;
          }
          component2.blocks[pos + k2] =
            (bitsData >>> (bitsCount - s)) & ((1 << s) - 1);
          bitsCount -= s;
          if (component2.blocks[pos + k2] < 1 << (s - 1))
            component2.blocks[pos + k2] += (-1 << s) + 1;
          component2.blocks[pos + k2] *= p1;
          k2++;
        }
      }
      function decodeACSuccessive(component2, pos) {
        let k2 = spectralStart,
          r,
          s;
        if (frame == null) throw "Frame not defined";
        if (!eobrun) {
          while (k2 <= spectralEnd) {
            while (bitsCount < 16) {
              bitsData = (bitsData << 8) + (data2[offset2] | 0);
              bitsCount += 8;
              if (data2[offset2] == 255) offset2++;
              offset2++;
            }
            s =
              component2.huffmanTableAC[
                (bitsData >>> (bitsCount - 16)) & 65535
              ];
            if (!s) throw "invalid huffman sequence";
            bitsCount -= s >>> 8;
            r = (s >> 4) & 15;
            s &= 15;
            if (s) {
              if (s != 1) throw "bad jpeg";
              if (!bitsCount) {
                bitsData = data2[offset2++];
                if (bitsData == 255) offset2++;
                bitsCount = 8;
              }
              s = (bitsData >>> --bitsCount) & 1 ? p1 : m1;
            } else {
              if (r != 15) {
                eobrun = 1 << r;
                if (r) {
                  while (bitsCount < r) {
                    bitsData = (bitsData << 8) + data2[offset2++];
                    if ((bitsData & 255) == 255) offset2++;
                    bitsCount += 8;
                  }
                  eobrun += (bitsData >>> (bitsCount - r)) & ((1 << r) - 1);
                  bitsCount -= r;
                }
                break;
              }
            }
            while (k2 <= spectralEnd) {
              if (component2.blocks[pos + k2]) {
                if (!bitsCount) {
                  bitsData = data2[offset2++];
                  if (bitsData == 255) offset2++;
                  bitsCount = 8;
                }
                component2.blocks[pos + k2] +=
                  ((bitsData >>> --bitsCount) & 1) *
                  (component2.blocks[pos + k2] >= 0 ? p1 : m1);
              } else {
                if (--r < 0) break;
              }
              k2++;
            }
            if (s) component2.blocks[pos + k2] = s;
            k2++;
          }
        }
        if (eobrun) {
          while (k2 <= spectralEnd) {
            if (component2.blocks[pos + k2]) {
              if (!bitsCount) {
                bitsData = data2[offset2++];
                if (bitsData == 255) offset2++;
                bitsCount = 8;
              }
              component2.blocks[pos + k2] +=
                ((bitsData >>> --bitsCount) & 1) *
                (component2.blocks[pos + k2] >= 0 ? p1 : m1);
            }
            k2++;
          }
          eobrun--;
        }
      }
      let decodeFn;
      if (frame.progressive) {
        if (spectralStart === 0)
          decodeFn =
            successivePrev === 0 ? decodeDCFirst : decodeDCSuccessive;
        else
          decodeFn =
            successivePrev === 0 ? decodeACFirst : decodeACSuccessive;
      } else {
        decodeFn = decodeBaseline;
      }
      let marker, mcuExpected, i2, j2, k, n, mcusPerLine, mcusPerRow, x, y;
      let lastflushidx = 0;
      const flushBits = () => {
        if (!this.gengen) return;
        const component2 = components.find((e) => e.componentId == 1);
        while (component2.blocks[lastflushidx + 1] !== void 0) {
          const blk = component2.blocks[lastflushidx];
          if (blk != 0) {
            const v = blk < 0 ? 1 - (blk & 1) : blk & 1;
            const it = this.gengen.next(v);
            if (it.done) {
              throw it.value;
            }
          }
          lastflushidx++;
        }
      };
      if (components.length == 1) {
        mcusPerLine = components[0].blocksPerLine;
        mcusPerRow = components[0].blocksPerColumn;
        mcuExpected = mcusPerRow * mcusPerLine;
        if (!resetInterval2) resetInterval2 = mcuExpected;
        n = resetInterval2;
        components[0].pred = 0;
        eobrun = 0;
        for (y = 0; y < mcusPerRow; y++) {
          for (x = 0; x < mcusPerLine; x++) {
            if (!n) {
              n = resetInterval2;
              components[0].pred = 0;
              eobrun = 0;
              offset2 -= (bitsCount / 8) | 0;
              if (data2[offset2 - 1] == 255) offset2--;
              bitsCount = 0;
              marker = (data2[offset2] << 8) | data2[offset2 + 1];
              if (marker >= 65488 && marker <= 65495) {
                offset2 += 2;
              } else {
                if (marker <= 65280) {
                  throw "bad jpeg";
                }
                break;
              }
            }
            n--;
            for (i2 = 0; i2 < components.length; i2++) {
              decodeFn(
                components[i2],
                (y * components[i2].blocksPerLineForMcu + x) * 64
              );
            }
          }
          flushBits();
        }
      } else {
        mcusPerLine = frame.mcusPerLine;
        mcusPerRow = frame.mcusPerColumn;
        mcuExpected = mcusPerRow * mcusPerLine;
        if (!resetInterval2) resetInterval2 = mcuExpected;
        n = resetInterval2;
        for (i2 = 0; i2 < components.length; i2++) components[i2].pred = 0;
        eobrun = 0;
        for (y = 0; y < mcusPerRow; y++) {
          for (x = 0; x < mcusPerLine; x++) {
            if (!n) {
              n = resetInterval2;
              for (i2 = 0; i2 < components.length; i2++)
                components[i2].pred = 0;
              eobrun = 0;
              offset2 -= (bitsCount / 8) | 0;
              if (data2[offset2 - 1] == 255) offset2--;
              bitsCount = 0;
              marker = (data2[offset2] << 8) | data2[offset2 + 1];
              if (marker >= 65488 && marker <= 65495) {
                offset2 += 2;
              } else {
                if (marker <= 65280) {
                  throw "bad jpeg";
                }
                break;
              }
            }
            n--;
            for (i2 = 0; i2 < components.length; i2++) {
              for (j2 = 0; j2 < components[i2].v; j2++) {
                for (k = 0; k < components[i2].h; k++) {
                  decodeFn(
                    components[i2],
                    ((y * components[i2].v + j2) *
                      components[i2].blocksPerLineForMcu +
                      x * components[i2].h +
                      k) *
                      64
                  );
                }
              }
            }
          }
          flushBits();
        }
      }
      offset2 -= (bitsCount / 8) | 0;
      if (data2[offset2 - 1] == 255) offset2--;
      return offset2 - startOffset;
    };
    function readUint16() {
      const value = (data[offset] << 8) | data[offset + 1];
      offset += 2;
      return value;
    }
    function readDataBlock() {
      const length = readUint16();
      const array = data.subarray(offset, offset + length - 2);
      offset += array.length;
      return array;
    }
    this.#_raw = data;
    this.#jfif = null;
    this.#APPn = [];
    this.#qts = [];
    this.#frame = null;
    this.#tail = null;
    let markerHi, markerLo, i, j, resetInterval, component;
    const huffmanTablesAC = [];
    const huffmanTablesDC = [];
    while (1) {
      if (offset >= data.length) {
        if (tolerant) break;
        throw "unexpected EOF";
      }
      markerHi = data[offset++];
      markerLo = data[offset++];
      if (markerHi == 255) {
        if (markerLo == 224) {
          this.#jfif = readDataBlock();
        }
        if ((markerLo > 224 && markerLo < 240) || markerLo == 254) {
          this.#APPn.push({
            app: markerLo,
            data: readDataBlock(),
          });
        }
        if (markerLo == 219) {
          this.#qts.push(readDataBlock());
        }
        if (markerLo >= 192 && markerLo <= 194) {
          if (this.#frame) throw "Only single frame JPEGs supported";
          readUint16();
          this.#frame = {
            extended: markerLo === 193,
            progressive: markerLo === 194,
            precision: data[offset++],
            scanLines: readUint16(),
            samplesPerLine: readUint16(),
            components: [],
            componentIds: {},
            maxH: 1,
            maxV: 1,
          };
          if (
            this.#frame.scanLines * this.#frame.samplesPerLine >
            this.maxPixels
          )
            throw "Image is too big.";
          var componentsCount = data[offset++],
            componentId;
          let maxH = 0,
            maxV = 0;
          for (i = 0; i < componentsCount; i++) {
            componentId = data[offset];
            const h = data[offset + 1] >> 4;
            const v = data[offset + 1] & 15;
            if (maxH < h) maxH = h;
            if (maxV < v) maxV = v;
            const qId = data[offset + 2];
            const l = this.#frame.components.push({
              componentId,
              h,
              v,
              quantizationTable: qId,
            });
            this.#frame.componentIds[componentId] = l - 1;
            offset += 3;
          }
          this.#frame.maxH = maxH;
          this.#frame.maxV = maxV;
          const mcusPerLine = Math.ceil(
            this.#frame.samplesPerLine / 8 / maxH
          );
          const mcusPerColumn = Math.ceil(this.#frame.scanLines / 8 / maxV);
          for (i = 0; i < this.#frame.components.length; i++) {
            component = this.#frame.components[i];
            const blocksPerLine = Math.ceil(
              (Math.ceil(this.#frame.samplesPerLine / 8) * component.h) / maxH
            );
            const blocksPerColumn = Math.ceil(
              (Math.ceil(this.#frame.scanLines / 8) * component.v) / maxV
            );
            const blocksPerLineForMcu = mcusPerLine * component.h;
            const blocksPerColumnForMcu = mcusPerColumn * component.v;
            this.#frame.components[i] = {
              ...component,
              blocks: new Int16Array(
                blocksPerColumnForMcu * blocksPerLineForMcu * 64
              ),
              blocksDC: new Int16Array(
                blocksPerColumnForMcu * blocksPerLineForMcu
              ),
              blocksPerLine,
              blocksPerColumn,
              blocksPerLineForMcu,
              blocksPerColumnForMcu,
            };
          }
          this.#frame.mcusPerLine = mcusPerLine;
          this.#frame.mcusPerColumn = mcusPerColumn;
        }
        if (markerLo == 196) {
          const huffmanLength = readUint16();
          for (i = 2; i < huffmanLength; ) {
            const huffmanTableSpec = data[offset++];
            const codeLengths = new Uint8Array(16);
            let codeLengthSum = 0;
            for (j = 0; j < 16; j++, offset++)
              codeLengthSum += codeLengths[j] = data[offset];
            const huffmanValues = new Uint8Array(codeLengthSum);
            for (j = 0; j < codeLengthSum; j++, offset++)
              huffmanValues[j] = data[offset];
            i += 17 + codeLengthSum;
            const v = _buildHuffmanTable(codeLengths, huffmanValues);
            if (huffmanTableSpec >> 4 === 0)
              huffmanTablesDC[huffmanTableSpec & 15] = v;
            else huffmanTablesAC[huffmanTableSpec & 15] = v;
          }
        }
        if (markerLo == 221) {
          resetInterval = readUint16();
        }
        if (markerLo == 218) {
          if (this.#frame == null) throw "SOS before SOF";
          readUint16();
          const selectorsCount = data[offset++];
          const components = [];
          for (i = 0; i < selectorsCount; i++) {
            const componentIndex = this.#frame.componentIds[data[offset++]];
            component = this.#frame.components[componentIndex];
            const tableSpec = data[offset++];
            component.huffmanTableDC = huffmanTablesDC[tableSpec >> 4];
            component.huffmanTableAC = huffmanTablesAC[tableSpec & 15];
            components.push(component);
          }
          const spectralStart = data[offset++];
          const spectralEnd = data[offset++];
          const successiveApproximation = data[offset++];
          const processed2 = decodeScan(
            data,
            offset,
            this.#frame,
            components,
            resetInterval,
            spectralStart,
            spectralEnd,
            successiveApproximation >> 4,
            successiveApproximation & 15
          );
          offset += processed2;
        }
        if (markerLo == 217) {
          break;
        }
      } else {
        if (
          data[offset - 3] == 255 &&
          data[offset - 2] >= 192 &&
          data[offset - 2] <= 254
        ) {
          offset -= 3;
        }
        while (data[offset] != 255 && offset < data.length) {
          offset++;
        }
        if (data[offset] != 255) {
          throw "bad jpeg ";
        }
      }
    }
    if (!this.#frame) throw "bad jpeg";
    if (offset < data.length) this.#tail = data.subarray(offset);
    return this;
  }
  pack() {
    let byteout;
    let bytenew;
    let bytepos;
    let poslast;
    let outpos;
    let byte;
    function writeByte(value) {
      let t;
      byteout[outpos++] = value;
      if (outpos > poslast) {
        t = new Uint8Array(byteout.length * 2);
        t.set(byteout);
        byteout = t;
        poslast = t.length - 128;
      }
    }
    function writeWord(value) {
      writeByte((value >> 8) & 255);
      writeByte(value & 255);
    }
    function writeBlock(block) {
      let t;
      if (outpos + block.length > poslast) {
        t = new Uint8Array(byteout.length * 2 + block.length);
        t.set(byteout);
        byteout = t;
        poslast = t.length - 128;
      }
      byteout.set(block, outpos);
      outpos += block.length;
    }
    function writeAPP0(self) {
      writeWord(65504);
      if (!self.#jfif) {
        writeWord(16);
        writeByte(74);
        writeByte(70);
        writeByte(73);
        writeByte(70);
        writeByte(0);
        writeByte(1);
        writeByte(1);
        writeByte(0);
        writeWord(1);
        writeWord(1);
        writeByte(0);
        writeByte(0);
      } else {
        writeWord(self.#jfif.length + 2);
        writeBlock(self.#jfif);
      }
    }
    function writeDQT(self) {
      for (let i2 = 0; i2 < self.#qts.length; i2++) {
        writeWord(65499);
        writeWord(self.#qts[i2].length + 2);
        writeBlock(self.#qts[i2]);
      }
    }
    function writeAPPn(self) {
      for (let i2 = 0; i2 < self.#APPn.length; i2++) {
        writeWord(65280 | self.#APPn[i2].app);
        writeWord(self.#APPn[i2].data.length + 2);
        writeBlock(self.#APPn[i2].data);
      }
    }
    function writeSOF0(self) {
      if (!self.#frame) throw "Frame not ready";
      writeWord(65472);
      writeWord(8 + self.#frame.components.length * 3);
      writeByte(self.#frame.precision);
      writeWord(self.#frame.scanLines);
      writeWord(self.#frame.samplesPerLine);
      writeByte(self.#frame.components.length);
      for (let i2 = 0; i2 < self.#frame.components.length; i2++) {
        const c2 = self.#frame.components[i2];
        writeByte(c2.componentId);
        writeByte((c2.h << 4) | c2.v);
        writeByte(c2.quantizationTable);
      }
    }
    function writeDHT(self) {
      if (!self.#frame) throw "Frame not ready";
      writeWord(65476);
      writeWord(31);
      writeByte(0);
      for (let i2 = 0; i2 < 16; i2++) {
        writeByte(std_dc_luminance_nrcodes[i2 + 1]);
      }
      for (let j = 0; j <= 11; j++) {
        writeByte(std_dc_luminance_values[j]);
      }
      writeWord(65476);
      writeWord(181);
      writeByte(16);
      for (let k = 0; k < 16; k++) {
        writeByte(std_ac_luminance_nrcodes[k + 1]);
      }
      for (let l = 0; l <= 161; l++) {
        writeByte(std_ac_luminance_values[l]);
      }
      if (self.#frame.components.length != 1) {
        writeWord(65476);
        writeWord(31);
        writeByte(1);
        for (let m = 0; m < 16; m++) {
          writeByte(std_dc_chrominance_nrcodes[m + 1]);
        }
        for (let n = 0; n <= 11; n++) {
          writeByte(std_dc_chrominance_values[n]);
        }
        writeWord(65476);
        writeWord(181);
        writeByte(17);
        for (let o = 0; o < 16; o++) {
          writeByte(std_ac_chrominance_nrcodes[o + 1]);
        }
        for (let p = 0; p <= 161; p++) {
          writeByte(std_ac_chrominance_values[p]);
        }
      }
    }
    function writeSOS(self) {
      if (!self.#frame) throw "Frame not ready";
      writeWord(65498);
      writeWord(6 + self.#frame.components.length * 2);
      writeByte(self.#frame.components.length);
      for (let i2 = 0; i2 < self.#frame.components.length; i2++) {
        const c2 = self.#frame.components[i2];
        writeByte(c2.componentId);
        if (i2 === 0) {
          writeByte(0);
        } else {
          writeByte(17);
        }
      }
      writeByte(0);
      writeByte(63);
      writeByte(0);
    }
    function processDU(comp, POS, DC, HTDC, HTAC) {
      let pos, posval, t;
      if (bytepos === 0) bytenew = 0;
      if (!("blocks" in comp)) throw "Blocks not parsed";
      const Diff = comp.blocksDC[POS >> 6] - DC;
      DC = comp.blocksDC[POS >> 6];
      if (Diff === 0) {
        posval = HTDC[0][1];
        bytenew <<= posval;
        bytenew += HTDC[0][0];
        bytepos += posval;
        while (bytepos > 7) {
          byte = 255 & (bytenew >>> (bytepos - 8));
          byteout[outpos++] = byte;
          if (byte == 255) {
            outpos++;
          }
          bytepos -= 8;
          bytenew &= (1 << bytepos) - 1;
        }
      } else {
        pos = 32767 + Diff;
        posval = HTDC[category[pos]][1];
        bytenew <<= posval;
        bytenew += HTDC[category[pos]][0];
        bytepos += posval;
        posval = bitcode[pos][1];
        bytenew <<= posval;
        bytenew += bitcode[pos][0];
        bytepos += posval;
        while (bytepos > 7) {
          byte = 255 & (bytenew >>> (bytepos - 8));
          byteout[outpos++] = byte;
          if (byte == 255) {
            outpos++;
          }
          bytepos -= 8;
          bytenew &= (1 << bytepos) - 1;
        }
      }
      let end0pos = 63;
      for (; end0pos > 0 && comp.blocks[POS + end0pos] === 0; end0pos--) {}
      if (end0pos === 0) {
        posval = HTAC[0][1];
        bytenew <<= posval;
        bytenew += HTAC[0][0];
        bytepos += posval;
        while (bytepos > 7) {
          byte = 255 & (bytenew >>> (bytepos - 8));
          byteout[outpos++] = byte;
          if (byte == 255) {
            outpos++;
          }
          bytepos -= 8;
          bytenew &= (1 << bytepos) - 1;
        }
        return DC;
      }
      let i2 = 1;
      let lng;
      while (i2 <= end0pos) {
        const startpos = i2;
        for (; comp.blocks[POS + i2] === 0 && i2 <= end0pos; ++i2) {}
        let nrzeroes = i2 - startpos;
        if (nrzeroes >= 16) {
          lng = nrzeroes >> 4;
          for (let nrmarker = 1; nrmarker <= lng; ++nrmarker) {
            posval = HTAC[240][1];
            bytenew <<= posval;
            bytenew += HTAC[240][0];
            bytepos += posval;
            while (bytepos > 7) {
              byte = 255 & (bytenew >>> (bytepos - 8));
              byteout[outpos++] = byte;
              if (byte == 255) {
                outpos++;
              }
              bytepos -= 8;
              bytenew &= (1 << bytepos) - 1;
            }
          }
          nrzeroes = nrzeroes & 15;
        }
        pos = 32767 + comp.blocks[POS + i2];
        posval = HTAC[(nrzeroes << 4) + category[pos]][1];
        bytenew <<= posval;
        bytenew += HTAC[(nrzeroes << 4) + category[pos]][0];
        bytepos += posval;
        while (bytepos > 7) {
          byte = 255 & (bytenew >>> (bytepos - 8));
          byteout[outpos++] = byte;
          if (byte == 255) {
            outpos++;
          }
          bytepos -= 8;
          bytenew &= (1 << bytepos) - 1;
        }
        posval = bitcode[pos][1];
        bytenew <<= posval;
        bytenew += bitcode[pos][0];
        bytepos += posval;
        while (bytepos > 7) {
          byte = 255 & (bytenew >>> (bytepos - 8));
          byteout[outpos++] = byte;
          if (byte == 255) {
            outpos++;
          }
          bytepos -= 8;
          bytenew &= (1 << bytepos) - 1;
        }
        i2++;
      }
      if (end0pos != 63) {
        posval = HTAC[0][1];
        bytenew <<= posval;
        bytenew += HTAC[0][0];
        bytepos += posval;
        while (bytepos > 7) {
          byte = 255 & (bytenew >>> (bytepos - 8));
          byteout[outpos++] = byte;
          if (byte == 255) {
            outpos++;
          }
          bytepos -= 8;
          bytenew &= (1 << bytepos) - 1;
        }
      }
      if (outpos > poslast) {
        t = new Uint8Array(byteout.length * 2);
        t.set(byteout);
        byteout = t;
        poslast = t.length - 128;
      }
      return DC;
    }
    byteout = new Uint8Array(65536);
    poslast = 65536 - 128;
    outpos = 0;
    bytenew = 0;
    bytepos = 0;
    writeWord(65496);
    writeAPP0(this);
    writeAPPn(this);
    writeDQT(this);
    writeSOF0(this);
    writeDHT(this);
    writeSOS(this);
    bytenew = 0;
    bytepos = 0;
    if (!this.#frame) throw "Frame not ready";
    let c, mcuRow, mcuCol, blockRow, blockCol, mcu, i, v, h;
    const DCdiff = [];
    for (i = 0; i < this.#frame.components.length; i++) {
      DCdiff.push(0);
    }
    for (
      mcu = 0;
      mcu < this.#frame.mcusPerLine * this.#frame.mcusPerColumn;
      mcu++
    ) {
      mcuRow = (mcu / this.#frame.mcusPerLine) | 0;
      mcuCol = mcu % this.#frame.mcusPerLine;
      for (i = 0; i < this.#frame.components.length; i++) {
        c = this.#frame.components[i];
        for (v = 0; v < c.v; v++) {
          blockRow = mcuRow * c.v + v;
          for (h = 0; h < c.h; h++) {
            blockCol = mcuCol * c.h + h;
            if (i === 0) {
              DCdiff[i] = processDU(
                c,
                (blockRow * this.#frame.mcusPerLine * c.h + blockCol) * 64,
                DCdiff[i],
                YDC_HT,
                YAC_HT
              );
            } else {
              DCdiff[i] = processDU(
                c,
                (blockRow * this.#frame.mcusPerLine * c.h + blockCol) * 64,
                DCdiff[i],
                UVDC_HT,
                UVAC_HT
              );
            }
          }
        }
      }
    }
    while (bytepos > 7) {
      byte = 255 & (bytenew >>> (bytepos - 8));
      byteout[outpos++] = byte;
      if (byte == 255) {
        outpos++;
      }
      bytepos -= 8;
    }
    if (bytepos > 0) {
      bytenew <<= 8 - bytepos;
      bytenew += (1 << (8 - bytepos)) - 1;
      byteout[outpos++] = 255 & bytenew;
    }
    writeWord(65497);
    if (this.#tail) writeBlock(this.#tail);
    return byteout.slice(0, outpos);
  }
};

var _jpeF5Key = 'CUNNYCUNNYCUNNY';

function _jpeGetF5() {
    return new f5stego(_jpeF5Key);
}

const jpeEmbedJpg = async (jpgBytes, items) => {
    const payload = await encodeUrlList(items);
    if (payload.length === 0) throw new Error('No embeddable items');

    if (jpgBytes.length / 20 < payload.length) {
        throw new Error('JPG too small to embed (' + jpgBytes.length + ' bytes / 20 < payload ' + payload.length + ')');
    }
    return _jpeGetF5().embed(jpgBytes, payload, 1);
};

const jpeExtractJpg = async (jpgBytes) => {
    try {
        const out = _jpeGetF5().extract(jpgBytes);
        if (!out) return [];

        if (out.length > 1024) return [];
        return await decodeUrlList(out);
    } catch (e) {
        return [];
    }
};

const gmReq = (typeof GM_xmlhttpRequest !== 'undefined') ? GM_xmlhttpRequest
            : (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest
            : null;

const JPE_RAND_NAME_ALPHA = 'abcdefghijklmnopqrstuvwxyz0123456789';
function _jpeRandomName(len) {
    var s = '';
    var arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    for (var i = 0; i < len; i++) s += JPE_RAND_NAME_ALPHA[arr[i] % JPE_RAND_NAME_ALPHA.length];
    return s;
}
function _jpeRandomFilenameFor(file) {
    var origName = (file && file.name) ? file.name : '';
    var m = origName.match(/\.[A-Za-z0-9]{1,8}$/);
    var ext = m ? m[0].toLowerCase() : '';
    return _jpeRandomName(12) + ext;
}
const uploadToWaifuvault = (file, onProgress) => new Promise((resolve, reject) => {
    if (!gmReq) {
        reject(new Error('GM_xmlhttpRequest unavailable; cannot upload cross-origin'));
        return;
    }
    var fd = new FormData();

    var randName = _jpeRandomFilenameFor(file);
    fd.append('file', file, randName);
    jpeLog('uploadToWaifuvault: randName=' + randName + ' (orig=' + (file.name || '(none)') + ') size=' + file.size + ' type=' + file.type);
    gmReq({
        method: 'PUT',
        url: 'https://waifuvault.moe/rest?expires=7d&hide_filename=true',
        data: fd,
        timeout: 120000,
        responseType: 'text',
        upload: onProgress ? {
            onprogress: (e) => {
                if (e && e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
            },
        } : undefined,
        onload: (r) => {
            jpeLog('uploadToWaifuvault onload status=' + r.status + ' responseLen=' + (r.responseText || '').length);
            if (r.status >= 200 && r.status < 300) {
                try {
                    var j = JSON.parse(r.responseText || '');
                    if (j && typeof j.url === 'string' && /^https:\/\//.test(j.url)) {
                        resolve(j.url);
                    } else {
                        reject(new Error('waifuvault returned no url field: ' + (r.responseText || '').slice(0, 200)));
                    }
                } catch (e) {
                    reject(new Error('waifuvault returned non-JSON: ' + (r.responseText || '').slice(0, 200)));
                }
            } else {
                const detail = (r.responseText || '').slice(0, 200).replace(/\s+/g, ' ');
                reject(new Error('waifuvault HTTP ' + r.status + (detail ? ' — ' + detail : '')));
            }
        },
        onerror: (r) => reject(new Error('waifuvault network error: ' + ((r && r.statusText) || 'unknown'))),
        ontimeout: () => reject(new Error('waifuvault upload timed out after 120s')),
        onabort: () => reject(new Error('waifuvault upload aborted')),
    });
});

const describeInput = (inp) => {
    if (!inp) return 'null';
    const path = [];
    let n = inp;
    while (n && n !== document.body) {
        let s = (n.tagName || '').toLowerCase();
        if (n.id) s += '#' + n.id;
        if (n.className && typeof n.className === 'string') s += '.' + n.className.trim().split(/\s+/).join('.');
        path.unshift(s);
        n = n.parentElement;
    }
    return path.join(' > ') + ` [accept=${inp.accept || ''} hidden=${inp.hidden} disp=${getComputedStyle(inp).display}]`;
};

const getReplyFileInput = () => {
    const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
    jpeLog('found', inputs.length, 'file inputs:', inputs.map(describeInput));
    const candidates = inputs.filter((inp) => {

        if (inp.id === 'jpe-hidden-input' || inp.id === 'jpe-base-input') return false;
        if (inp.id === 'jpe-secondary' || inp.id === 'jpe-base') return false;
        if (inp.id === 'secret_image' || inp.id === 'importSettings') return false;
        const accept = (inp.accept || '').toLowerCase();
        return accept.includes('image/png');
    });
    const articleNested = candidates.find((inp) => inp.closest('article'));
    if (articleNested) { jpeLog('picked article-nested reply input'); return articleNested; }
    const newThread = candidates.find((inp) => {
        const f = inp.closest('#new-reply-form');
        return f && !f.classList.contains('hidden');
    });
    if (newThread) { jpeLog('picked #new-reply-form (new-thread) input'); return newThread; }
    return null;
};

const setInputFile = (input, file) => {
    jpeLog('setInputFile target:', describeInput(input), 'file:', file.name, file.size, 'bytes,', file.type);
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    const ev = new Event('change', { bubbles: true });
    input.dispatchEvent(ev);
};

const fileToUint8 = (file) => file.arrayBuffer().then((b) => new Uint8Array(b));

const uint8ToFile = (bytes, name, type = 'image/png') =>
    new File([bytes], name, { type });

const g_jpeScanned = new WeakSet();
const g_jpeScannedUrls = new Map();

const _jpeFetchConcurrency = 5;
let _jpeFetchActive = 0;
const _jpeFetchPendingStarts = [];
const _jpeBytesCache = new Map();

function _jpeStartFetch(launchFn) {
    return new Promise((resolve, reject) => {
        const tryLaunch = () => {
            _jpeFetchActive++;
            launchFn().then(
                v => { _jpeFetchActive--; resolve(v); _jpeDrainFetch(); },
                e => { _jpeFetchActive--; reject(e); _jpeDrainFetch(); }
            );
        };
        if (_jpeFetchActive < _jpeFetchConcurrency) tryLaunch();
        else _jpeFetchPendingStarts.push(tryLaunch);
    });
}
function _jpeDrainFetch() {
    while (_jpeFetchActive < _jpeFetchConcurrency && _jpeFetchPendingStarts.length > 0) {
        _jpeFetchPendingStarts.shift()();
    }
}

const JPE_FULL_FETCH_MAX_BYTES = 25 * 1024 * 1024;
const JPE_EXT_FULL_FETCH = /\.(png|jpe?g)$/i;

async function _jpeProbeSize(url) {
    try {
        const head = await fetch(url, { method: 'HEAD', cache: 'force-cache', credentials: 'same-origin' });
        if (!head.ok) return NaN;
        const cl = head.headers.get('Content-Length');
        return cl ? parseInt(cl, 10) : NaN;
    } catch (e) { return NaN; }
}

function jpeSharedFetch(url) {
    const cached = _jpeBytesCache.get(url);
    if (cached) return cached;
    const p = _jpeStartFetch(async () => {

        const size = await _jpeProbeSize(url);
        if (Number.isFinite(size) && size > JPE_FULL_FETCH_MAX_BYTES) {
            throw new Error('over-size cap');
        }
        const r = await fetch(url, { cache: 'force-cache', credentials: 'same-origin' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return new Uint8Array(await r.arrayBuffer());
    });
    _jpeBytesCache.set(url, p);

    const evict = () => { _jpeBytesCache.delete(url); };
    p.then(evict, evict);
    return p;
}

const fetchBytes = (url) => jpeSharedFetch(url);

const g_jpeBlobCache = new Map();

const g_jpeBlobFailedAt = new Map();
const JPE_BLOB_RETRY_COOLDOWN_MS = 60 * 1000;

function _jpeFetchAsBlob(url, mimeHint) {
    return new Promise(function (resolve, reject) {
        if (!gmReq) { reject(new Error('GM_xmlhttpRequest unavailable')); return; }
        gmReq({
            method: 'GET',
            url: url,
            responseType: 'blob',
            timeout: 120000,
            onload: function (r) {
                if (r.status >= 200 && r.status < 300 && r.response) {

                    if (r.response instanceof Blob) resolve(r.response);
                    else if (r.response instanceof ArrayBuffer) resolve(new Blob([r.response], { type: mimeHint || 'application/octet-stream' }));
                    else reject(new Error('unexpected response type'));
                } else {
                    reject(new Error('HTTP ' + r.status));
                }
            },
            onerror: function () { reject(new Error('network error')); },
            ontimeout: function () { reject(new Error('timeout')); },
        });
    });
}

function _jpeRewriteForFetch(url) { return url; }

var JPE_FETCH_ALLOWED_HOSTS = new Set([
    'waifuvault.moe', 'uploads.waifuvault.moe'
]);
function _jpeFetchAllowed(url) {
    try { return JPE_FETCH_ALLOWED_HOSTS.has(new URL(url).host); }
    catch (e) { return false; }
}

function jpeGetBlobUrl(url, fileKey) {
    const cacheKey = fileKey ? (url + '|' + _jpeBytesToHex(fileKey)) : url;
    if (g_jpeBlobCache.has(cacheKey)) return g_jpeBlobCache.get(cacheKey);

    if (!_jpeFetchAllowed(url)) {
        var blocked = Promise.resolve(null);
        g_jpeBlobCache.set(cacheKey, blocked);
        jpeWarn('blob fetch skipped (host not allowed):', url);
        return blocked;
    }

    var lastFailed = g_jpeBlobFailedAt.get(cacheKey);
    if (lastFailed && (Date.now() - lastFailed) < JPE_BLOB_RETRY_COOLDOWN_MS) {
        return Promise.resolve(null);
    }
    var ext = (url.split('.').pop() || '').toLowerCase().split(/[?#]/)[0];
    var mime = ({
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
        gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
        mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
        m4v: 'video/mp4', mkv: 'video/x-matroska',
        mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav',
        flac: 'audio/flac', opus: 'audio/opus', m4a: 'audio/mp4',
    })[ext] || 'application/octet-stream';
    var fetchUrl = _jpeRewriteForFetch(url);

    function tryOnce() {
        return _jpeFetchAsBlob(fetchUrl, mime).then(async function (blob) {
            if (!fileKey) return URL.createObjectURL(blob);
            try {
                const buf = await blob.arrayBuffer();
                const plainBytes = await _jpeDecryptArrayBuffer(buf, fileKey);
                const plainBlob = new Blob([plainBytes], { type: mime });
                return URL.createObjectURL(plainBlob);
            } catch (e) {
                jpeWarn('client-side decrypt failed for', url, e && e.message);
                throw e;
            }
        });
    }
    var p = tryOnce().catch(function (e1) {
        jpeWarn('blob fetch failed for', url, e1.message, '— retrying once in 10s');
        return new Promise(function (resolve) {
            setTimeout(function () {
                tryOnce().then(resolve, function (e2) {
                    jpeWarn('blob fetch retry failed for', url, e2.message, '— will retry after ' + (JPE_BLOB_RETRY_COOLDOWN_MS / 1000) + 's cooldown');
                    g_jpeBlobFailedAt.set(cacheKey, Date.now());
                    resolve(null);
                });
            }, 10000);
        });
    });

    p.then(function (result) {
        if (result === null) g_jpeBlobCache.delete(cacheKey);
    });
    g_jpeBlobCache.set(cacheKey, p);
    return p;
}

function _jpeBlobUrlForItem(it) {
    if (!it) return Promise.resolve(null);
    if (it.kind === 'encUrl' && it.fileKey) return jpeGetBlobUrl(it.value, it.fileKey);
    return jpeGetBlobUrl(it.value);
}

const toggleExpand = (e) => {
    if (e && (e.ctrlKey || e.metaKey || e.button === 1 || e.shiftKey)) return;
    if (e) e.preventDefault();
    const el = e ? (e.currentTarget || e.target) : null;
    if (!el) return;
    el.classList.toggle('jpe-expanded');

    const parent = el.closest('.jpe-embed');
    if (parent) parent.classList.toggle('jpe-embed-expanded', el.classList.contains('jpe-expanded'));

    document.querySelectorAll('.jpe-hover-preview').forEach(function (p) { p.remove(); });
};

const positionPreview = (preview, e) => {
    const pad = 16;
    const w = preview.offsetWidth || 300;
    const h = preview.offsetHeight || 300;
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    if (x + w > window.innerWidth - 4)  x = Math.max(4, e.clientX - pad - w);
    if (y + h > window.innerHeight - 4) y = Math.max(4, e.clientY - pad - h);
    preview.style.left = x + 'px';
    preview.style.top  = y + 'px';
};

const installHoverPreview = (thumbEl, item, isVideo) => {
    let preview = null;
    let lastEvent = null;

    const enter = (e) => {
        if (thumbEl.classList.contains('jpe-expanded')) return;

        if (document.querySelector('.jpe-thumb.jpe-expanded')) return;
        if (preview) return;
        lastEvent = e;
        preview = document.createElement(isVideo ? 'video' : 'img');
        if (isVideo) {
            preview.muted = true;
            preview.loop = true;
            preview.autoplay = true;
            preview.controls = false;
        }
        preview.className = 'jpe-hover-preview';
        preview.style.visibility = 'hidden';
        document.body.appendChild(preview);
        const onReady = () => {
            if (!preview) return;
            positionPreview(preview, lastEvent);
            preview.style.visibility = 'visible';
        };
        if (isVideo) {
            preview.addEventListener('loadedmetadata', onReady, { once: true });
        } else {
            preview.addEventListener('load', onReady, { once: true });
        }

        _jpeBlobUrlForItem(item).then(function (src) {
            if (!preview) return;

            if (!src) { preview.remove(); preview = null; return; }
            preview.src = src;
            if (!isVideo && preview.complete && preview.naturalWidth > 0) onReady();
        });
    };
    thumbEl.addEventListener('mouseenter', enter);
    thumbEl.addEventListener('mousemove', (e) => {
        lastEvent = e;
        if (preview && preview.style.visibility !== 'hidden') positionPreview(preview, e);
    });
    thumbEl.addEventListener('mouseleave', () => {
        if (preview) { preview.remove(); preview = null; }
    });
};

function alignEmbedsToBottom(figure) {
    if (!figure) return;
    var pc = figure.parentElement;
    if (!pc) return;
    function doAlign() {
        var liveEmbeds = pc.querySelectorAll(':scope > .jpe-embed-text');
        if (liveEmbeds.length === 0) return;
        var firstLive = liveEmbeds[0];
        firstLive.style.marginTop = '';

        void firstLive.offsetHeight;
        var figRect = figure.getBoundingClientRect();
        if (figRect.height === 0) return;
        var last = liveEmbeds[liveEmbeds.length - 1];
        var lastBottom = last.getBoundingClientRect().bottom;
        var gap = figRect.bottom - lastBottom;
        if (gap > 0) firstLive.style.marginTop = gap + 'px';
        jpeLog('alignEmbeds: figH=' + figRect.height + ' gap=' + gap.toFixed(1) + ' embeds=' + liveEmbeds.length);
    }

    requestAnimationFrame(function () {
        doAlign();
        setTimeout(doAlign, 100);
        setTimeout(doAlign, 500);
        setTimeout(doAlign, 1500);
        setTimeout(doAlign, 3000);
    });

    var embeds = pc.querySelectorAll(':scope > .jpe-embed-text');
    if (embeds.length === 0) return;
    var first = embeds[0];
    if (typeof ResizeObserver !== 'undefined' && !first.dataset.jpeAlignObserved) {
        first.dataset.jpeAlignObserved = '1';
        var ro = new ResizeObserver(function () { doAlign(); });
        ro.observe(figure);
        if (figure.querySelector('img')) ro.observe(figure.querySelector('img'));
        setTimeout(function () { try { ro.disconnect(); } catch (e) {} }, 30000);
    }
}

function _jpeRedactItemsForLog(items) {
    return items.map(function (it) {
        if (!it || typeof it !== 'object') return it;
        if ((it.kind === 'url' || it.kind === 'encUrl') && typeof it.value === 'string') {
            var name = it.value.split('/').pop() || '';
            return { kind: it.kind, value: '[w:' + name.slice(0, 8) + '…]' };
        }
        return it;
    });
}

function _jpeFigureWithinDays(figure, maxDays) {
    try {
        var article = figure.closest('article');
        if (!article) return true;
        var t = article.querySelector('time[datetime]');
        if (!t) return true;
        var ts = Date.parse(t.getAttribute('datetime'));
        if (isNaN(ts)) return true;
        var ageDays = (Date.now() - ts) / 86400000;
        return ageDays <= maxDays;
    } catch (e) { return true; }
}

function _jpeMakeLoadingPlaceholder(refFigure) {
    var ph = document.createElement('div');
    ph.className = 'jpe-loading';

    ph.style.width  = '86px';
    ph.style.height = '150px';
    var label = document.createElement('span');
    label.textContent = 'Loading';
    var dots = document.createElement('span');
    dots.textContent = '';
    ph.appendChild(label);
    ph.appendChild(dots);
    var n = 0;
    var tick = setInterval(function () {
        if (!ph.isConnected) { clearInterval(tick); return; }
        n = (n + 1) % 4;
        dots.textContent = '.'.repeat(n);
    }, 300);
    return ph;
}

function _jpeMarkPlaceholderUnavailable(ph) {
    if (!ph) return;
    ph.classList.add('jpe-unavailable');
    ph.textContent = 'Unavailable';
}

const renderEmbed = async (figure, items) => {
    if (figure.querySelector('.jpe-embed') || figure.dataset.jpeEmbedRendered) return;
    figure.dataset.jpeEmbedRendered = '1';

    const container = document.createElement('div');
    container.className = 'jpe-embed';
    const postContainer = figure.parentElement;
    const article = figure.closest('article');
    const blockquote = postContainer && postContainer.querySelector('blockquote');
    const norm = items.map(function (it) {
        return typeof it === 'string' ? { kind: 'url', value: it } : it;
    });

    const postIsRecent = _jpeFigureWithinDays(figure, 3);

    let hasLiveContent = false;
    let mediaCount = 0;
    for (const it of norm) {
        if (it.kind === 'text') {
            const t = document.createElement('div');
            t.className = 'jpe-text-embed';
            t.textContent = it.value;
            if (blockquote) blockquote.appendChild(t);
            else container.appendChild(t);
            hasLiveContent = true;
            continue;
        }
        const wrap = document.createElement('div');
        wrap.className = 'jpe-embed-item';
        const url = it.value;

        const isExpired = !_jpeFigureWithinDays(figure, 7);
        if (isExpired) {
            const ex = document.createElement('div');
            ex.className = 'jpe-loading jpe-expired';
            ex.textContent = 'Embed expired';
            wrap.appendChild(ex);
            container.appendChild(wrap);
            mediaCount++;
            continue;
        }

        hasLiveContent = true;
        const ext = url.split('.').pop().toLowerCase().split(/[?#]/)[0];
        if (['mp4', 'webm', 'mov', 'm4v', 'mkv'].includes(ext)) {

            const ph = _jpeMakeLoadingPlaceholder(figure);
            wrap.appendChild(ph);
            _jpeBlobUrlForItem(it).then(function (src) {
                if (!src) { _jpeMarkPlaceholderUnavailable(ph); return; }
                const video = document.createElement('video');
                video.controls = true;
                video.loop = true;
                video.preload = 'metadata';
                video.className = 'jpe-thumb';
                video.addEventListener('click', toggleExpand);
                installHoverPreview(video, it, true);
                video.src = src;
                ph.replaceWith(video);
            });
        } else if (['mp3', 'ogg', 'wav', 'flac', 'opus', 'm4a'].includes(ext)) {
            const ph = _jpeMakeLoadingPlaceholder(figure);
            wrap.appendChild(ph);
            _jpeBlobUrlForItem(it).then(function (src) {
                if (!src) { _jpeMarkPlaceholderUnavailable(ph); return; }
                const audio = document.createElement('audio');
                audio.controls = true;
                audio.src = src;
                ph.replaceWith(audio);
            });
        } else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp'].includes(ext)) {

            const ph = _jpeMakeLoadingPlaceholder(figure);
            wrap.appendChild(ph);
            _jpeBlobUrlForItem(it).then(function (src) {
                if (!src) { _jpeMarkPlaceholderUnavailable(ph); return; }
                const img = document.createElement('img');
                img.loading = 'lazy';
                img.draggable = false;
                img.className = 'jpe-thumb';
                img.addEventListener('click', (ev) => {
                    if (ev.ctrlKey || ev.metaKey || ev.button === 1 || ev.shiftKey) return;
                    ev.preventDefault();
                    toggleExpand({ currentTarget: img, preventDefault: function () {} });
                });
                installHoverPreview(img, it, false);
                img.src = src;
                ph.replaceWith(img);
            });
        } else {

            const a = document.createElement('a');
            a.textContent = '[embedded file]';
            a.target = '_blank';
            a.rel = 'noopener';
            wrap.appendChild(a);
            _jpeBlobUrlForItem(it).then(function (src) {
                if (src) a.href = src;
                else a.textContent = '[embedded file unavailable]';
            });
        }
        container.appendChild(wrap);
        mediaCount++;
    }

    if (mediaCount > 0) {
        figure.parentElement.insertBefore(container, figure.nextSibling);
    }

    if (article && hasLiveContent) article.classList.add('jpe-embed-live');
};

const scanFigure = async (figure) => {
    if (!figure) return;
    const a = figure.querySelector('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href) return;
    let url;
    try { url = new URL(href, location.href); } catch { return; }
    if (!AWOO_IMG_RE.test(url.pathname)) return;

    if (figure.dataset.jpeScannedUrl === url.href) return;
    figure.dataset.jpeScannedUrl = url.href;

    delete figure.dataset.jpeEmbedRendered;
    const oldEmbeds = figure.parentElement ? figure.parentElement.querySelectorAll('.jpe-embed') : [];
    for (var oi = 0; oi < oldEmbeds.length; oi++) oldEmbeds[oi].remove();
    g_jpeScanned.add(figure);

    const jpeEnabled    = currentlyEnabledOptions.has('jpeScanEnabled');
    const secretEnabled = currentlyEnabledOptions.has("imgsekritPosting");
    const jpeKnown    = g_jpeScannedUrls.has(url.href);
    const secretKnown = mgcSecretCache[url.href] !== undefined;
    const secretAlreadyDecoded = figure.dataset && figure.dataset.mgcSecretAdded;
    const needJpe    = jpeEnabled    && !jpeKnown;
    const needSecret = secretEnabled && !secretKnown && !secretAlreadyDecoded;

    if (needJpe)    _jpeScanCounter.start(1);
    if (needSecret) _secretScanCounter.start(1);

    try {

        if (!needJpe && !needSecret) {
            if (jpeEnabled) {
                const cached = g_jpeScannedUrls.get(url.href);
                if (cached && cached.length) renderEmbed(figure, cached);
            }
            if (secretEnabled && mgcSecretCache[url.href]) {
                try { addMessageToPost(url.pathname, mgcSecretCache[url.href]); } catch (e) {}
            }
            return;
        }

        let bytes;
        try { bytes = await fetchBytes(url.href); }
        catch (e) {
            if (needJpe)    g_jpeScannedUrls.set(url.href, []);
            if (needSecret) mgcSecretCache[url.href] = null;
            return;
        }

        if (needJpe) {
            let items = [];
            try {
                const type = jpeDetectImageType(bytes);
                if (type === 'png')      items = await jpeExtractPng(bytes);
                else if (type === 'jpg') items = await jpeExtractJpg(bytes);
                if (items.length === 0) items = await jpeExtractTrailer(bytes);
            } catch (e) { items = []; }
            g_jpeScannedUrls.set(url.href, items);
            if (items.length) {

                jpeLog('Found embed in', url.href, '→', _jpeRedactItemsForLog(items));
                renderEmbed(figure, items);
            }
        }

        if (needSecret) {
            try {

                const tailLen = 1200;
                const tail = bytes.byteLength > tailLen
                    ? bytes.subarray(bytes.byteLength - tailLen)
                    : bytes;
                let str = "";
                for (let i = 0; i < tail.byteLength; i++) str += String.fromCharCode(tail[i]);
                const last6 = str.substring(str.length - 6);
                if (last6 === "emsec1") {

                    const length = parseInt(str.substring(str.length - 11, str.length - 6), 10);
                    if (isNaN(length) || length <= 0 || length > tail.byteLength - 11) {
                        mgcSecretCache[url.href] = null;
                    } else {
                        const envBytes = tail.slice(tail.byteLength - 11 - length, tail.byteLength - 11);
                        const plainBytes = await _jpeDecryptPayload(envBytes);
                        if (!plainBytes) {
                            mgcSecretCache[url.href] = null;
                        } else {
                            const message = new TextDecoder().decode(plainBytes);
                            mgcSecretCache[url.href] = message;
                            addMessageToPost(url.pathname, message);
                        }
                    }
                } else if (last6 === "secret") {

                    const length = parseInt(str.substring(str.length - 9, str.length - 6), 10);
                    if (isNaN(length) || length <= 0 || length > tail.byteLength - 9) {
                        mgcSecretCache[url.href] = null;
                    } else {
                        const msgBytes = tail.slice(tail.byteLength - 9 - length, tail.byteLength - 9);
                        const message = new TextDecoder().decode(msgBytes);
                        mgcSecretCache[url.href] = message;
                        addMessageToPost(url.pathname, message);
                    }
                } else {
                    mgcSecretCache[url.href] = null;
                }
            } catch (e) {
                mgcSecretCache[url.href] = null;
            }
        }
    } finally {
        if (needJpe)    _jpeScanCounter.complete();
        if (needSecret) _secretScanCounter.complete();
    }
};

function _mkScanCounter(labelId) {
    var total = 0, done = 0;
    function update() {
        var el = document.getElementById(labelId);
        if (!el) return;
        el.textContent = (total === 0 || done >= total) ? ''
            : (' loading... (' + done + ' / ' + total + ')');
    }
    return {
        start: function (n) { total += n; update(); },
        complete: function () { done++; update(); },
    };
}
var _jpeScanCounter = _mkScanCounter('jpe-scan-progress');
var _secretScanCounter = _mkScanCounter('secret-scan-progress');

function _jpeScanStart(n) { _jpeScanCounter.start(n); }
function _jpeScanComplete() { _jpeScanCounter.complete(); }

const scanRoot = (root) => {
    if (!root.querySelectorAll) {
        if (root.tagName === 'FIGURE' && !g_jpeScanned.has(root)) scanFigure(root);
        return;
    }
    if (root.tagName === 'FIGURE') scanFigure(root);
    for (const fig of root.querySelectorAll('figure')) scanFigure(fig);
};

var g_jpeHiddenFile = null;
var g_jpeBaseFile = null;

var g_jpeUploadHost = 'waifu';

function setJpeStatus(msg, kind) {
    var el = document.getElementById('jpe-status');
    if (!el) return;
    el.textContent = msg;
    el.style.color = kind === 'err' ? '#ff7b7b' : kind === 'ok' ? '#7bff9b' : '#888';
}

function truncateJpeFilename(name) {
    var dotIdx = name.lastIndexOf('.');
    var base = dotIdx > 0 ? name.slice(0, dotIdx) : name;
    var ext  = dotIdx > 0 ? name.slice(dotIdx) : '';
    if (base.length <= 8) return name;
    return base.slice(0, 5) + '...' + base.slice(-3) + ext;
}

function formatJpeBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1024 * 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
    return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function _wireJpeBox(boxId, inputId, onPicked) {
    var box = document.getElementById(boxId);
    var input = document.getElementById(inputId);
    if (!box || !input) return;
    var nameSpan = box.querySelector('.jpe-filebox-name');
    var lastPasteAt = 0;
    box.addEventListener('click', function (e) {
        if (Date.now() - lastPasteAt < 1000) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        if (e.target === input) return;
        input.click();
    });
    box.addEventListener('paste', function (e) {
        var files = e.clipboardData && e.clipboardData.files;
        if (!files || files.length === 0) return;
        try {
            var dt = new DataTransfer();
            dt.items.add(files[0]);
            input.files = dt.files;
        } catch (er) {
            input.files = files;
        }
        lastPasteAt = Date.now();
        input.dispatchEvent(new Event('change', { bubbles: true }));
        e.preventDefault();
        e.stopPropagation();
    });

    box.addEventListener('dragenter', function (e) {
        e.preventDefault();
        box.classList.add('jpe-filebox-dragover');
    });
    box.addEventListener('dragover', function (e) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    });
    box.addEventListener('dragleave', function (e) {

        if (e.target === box) box.classList.remove('jpe-filebox-dragover');
    });
    box.addEventListener('drop', function (e) {
        e.preventDefault();
        e.stopPropagation();
        box.classList.remove('jpe-filebox-dragover');
        var files = e.dataTransfer && e.dataTransfer.files;
        if (!files || files.length === 0) return;
        try {
            var dt = new DataTransfer();
            dt.items.add(files[0]);
            input.files = dt.files;
        } catch (er) {
            input.files = files;
        }

        lastPasteAt = Date.now();
        input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    var clearBtn = box.querySelector('.jpe-filebox-clear');
    if (clearBtn) {
        clearBtn.addEventListener('click', function (e) {

            e.preventDefault();
            e.stopPropagation();
            input.value = '';
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }
    input.addEventListener('change', function () {
        var f = input.files[0] || null;
        if (nameSpan) {
            nameSpan.textContent = f ? truncateJpeFilename(f.name) : '(none)';
            nameSpan.title = f ? f.name : '';
        }
        if (clearBtn) clearBtn.style.display = f ? '' : 'none';
        onPicked(f);
    });
}

function jpeDetectImageType(bytes) {
    if (!bytes || bytes.length < 4) return 'unknown';

    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'png';

    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'jpg';
    return 'unknown';
}

function setupJpeBoxes() {

    var jpeChk = document.getElementById('jpeScanEnabled');
    if (jpeChk) {
        var stored = getFunc('jpeScanEnabled');
        var initiallyOn = (stored !== "off");
        jpeChk.checked = initiallyOn;
        if (initiallyOn) currentlyEnabledOptions.add('jpeScanEnabled');
        else currentlyEnabledOptions.delete('jpeScanEnabled');
        jpeChk.addEventListener('change', function () {
            if (jpeChk.checked) {
                currentlyEnabledOptions.add('jpeScanEnabled');
                setFunc('jpeScanEnabled', 'on');
            } else {
                currentlyEnabledOptions.delete('jpeScanEnabled');
                setFunc('jpeScanEnabled', 'off');
            }
        });
    }
    _wireJpeBox('jpe-hidden-box', 'jpe-hidden-input', function (f) {
        g_jpeHiddenFile = f;
        if (f) setJpeStatus('Hidden file loaded: ' + f.name);
    });
    _wireJpeBox('jpe-base-box', 'jpe-base-input', function (f) {
        g_jpeBaseFile = f;
        if (f) setJpeStatus('Base file loaded: ' + f.name);
    });

    var btn = document.getElementById('jpe-embed-input');
    if (!btn) return;
    var lastClickAt = 0;
    btn.addEventListener('click', async function () {
        var now = Date.now();
        if (now - lastClickAt < 1000) return;
        lastClickAt = now;
        if (btn.disabled) return;
        btn.disabled = true;
        setTimeout(function () { btn.disabled = false; }, 1000);
        try {

            var textEl = document.getElementById('jpe-text-input');
            var jpeText = textEl ? textEl.value.trim() : '';
            var customEl = document.getElementById('jpe-custom-input');
            var customUrl = customEl ? customEl.value.trim() : '';
            var hasFile = !!g_jpeHiddenFile;
            var hasText = jpeText.length > 0;
            var hasCustom = customUrl.length > 0;

            if (!hasFile && !hasText) {
                setJpeStatus('Provide a Hidden File or JPE text.', 'err');
                return;
            }
            if (!g_jpeBaseFile) { setJpeStatus('Pick a Base File first.', 'err'); return; }
            var baseBytes = await fileToUint8(g_jpeBaseFile);
            var type = jpeDetectImageType(baseBytes);
            if (type === 'unknown') {
                setJpeStatus('Base file must be a PNG or JPG.', 'err');
                return;
            }

            if (!document.getElementById('text-input')) {
                setJpeStatus('Opening reply form…');
                if (typeof mgcOpenReplyForm === 'function') mgcOpenReplyForm();
            }
            if (typeof mgcWaitForTextInput === 'function') {
                await mgcWaitForTextInput(3000);
            }
            var replyInput = getReplyFileInput();
            if (!replyInput) {
                setJpeStatus('Couldn’t find reply form file input.', 'err');
                return;
            }

            var items = [];
            if (hasText) items.push({ kind: 'text', value: jpeText });
            if (hasFile) {
                var currentPct = 0;
                var startTime = Date.now();
                var sizeStr = formatJpeBytes(g_jpeHiddenFile.size);
                var dots = 0;

                var ticker = setInterval(function () {
                    dots = (dots + 1) % 4;
                    var elapsed = Math.floor((Date.now() - startTime) / 1000);
                    var label = 'Uploading ' + sizeStr + '.'.repeat(dots) + ' (' + elapsed + 's';
                    if (currentPct > 0) label += ', ' + Math.round(currentPct * 100) + '%';
                    label += ')';
                    setJpeStatus(label);
                }, 300);
                try {

                    setJpeStatus('Encrypting…');
                    var encResult = await _jpeEncryptHiddenFile(g_jpeHiddenFile);
                    var url = await uploadToWaifuvault(encResult.encryptedFile, function (pct) {
                        currentPct = pct;
                    });
                    items.push({ kind: 'encUrl', value: url, fileKey: encResult.fileKey });
                } finally {
                    clearInterval(ticker);
                }
            }
            setJpeStatus('Embedding ' + items.length + ' item(s) into ' + type.toUpperCase() + '…');
            var embedded, back;
            if (type === 'png') {
                embedded = await jpeEmbedPng(baseBytes, items);
                back = await jpeExtractPng(embedded);
            } else {

                embedded = await jpeEmbedJpg(baseBytes, items);
                back = await jpeExtractJpg(embedded);
            }

            var missing = items.filter(function (sent) {
                return !back.some(function (got) {
                    return got.kind === sent.kind && got.value === sent.value;
                });
            });
            if (missing.length) {
                var diag = {
                    sentCount: items.length,
                    gotCount: back.length,
                    missingCount: missing.length,
                    sent: items.map(function (it) { return { kind: it.kind, len: (it.value || '').length, preview: (it.value || '').slice(0, 60) }; }),
                    got: back.map(function (it) { return { kind: it.kind, len: (it.value || '').length, preview: (it.value || '').slice(0, 60) }; }),
                    baseFileSize: g_jpeBaseFile.size,
                    embeddedSize: embedded.length,
                    type: type
                };
                jpeWarn('self-extract mismatch', diag);
                var hint = (type === 'png') ? ' (try a larger / less-compressed base PNG -- IDAT capacity may be exhausted)' : ' (try a larger base JPG)';
                throw new Error('Self-extract recovered ' + back.length + '/' + items.length + ' items' + hint);
            }
            var outFile = uint8ToFile(embedded, g_jpeBaseFile.name, g_jpeBaseFile.type || (type === 'png' ? 'image/png' : 'image/jpeg'));
            setInputFile(replyInput, outFile);
            setJpeStatus('Done. Embedded ' + items.length + ' item(s) into ' + type.toUpperCase() + '.', 'ok');

            try {
                const digest = await crypto.subtle.digest('SHA-1', embedded);
                const hex = Array.from(new Uint8Array(digest)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
                const ext = (type === 'png') ? 'png' : 'jpg';
                const predictedUrl = location.origin + '/assets/images/src/' + hex + '.' + ext;
                g_jpeScannedUrls.set(predictedUrl, items);
                jpeLog('Primed cache for predicted self-post URL', predictedUrl);

                (function safetyPoll() {
                    var attempts = 0;
                    var poll = setInterval(function () {
                        attempts++;
                        if (attempts > 20) { clearInterval(poll); return; }
                        var anchors = document.querySelectorAll('figure > a[href$="' + hex + '.' + ext + '"]');
                        if (anchors.length === 0) return;
                        var anyRendered = false;
                        for (var i = 0; i < anchors.length; i++) {
                            var fig = anchors[i].parentElement;
                            if (!fig) continue;
                            var pc = fig.parentElement;
                            if (!pc) continue;

                            var bq = pc.querySelector(':scope > blockquote');
                            var existingMedia = pc.querySelector(':scope > .jpe-embed');
                            var existingText  = bq && bq.querySelector(':scope > .jpe-text-embed');

                            var hasMedia = items.some(function (it) { return (typeof it === 'string') || it.kind === 'url' || it.kind === 'encUrl'; });
                            var hasText  = items.some(function (it) { return it && it.kind === 'text'; });
                            var mediaOk = !hasMedia || existingMedia;
                            var textOk  = !hasText  || existingText;
                            if (mediaOk && textOk) { anyRendered = true; continue; }

                            delete fig.dataset.jpeEmbedRendered;
                            if (existingMedia) existingMedia.remove();
                            if (bq) bq.querySelectorAll(':scope > .jpe-text-embed').forEach(function (n) { n.remove(); });
                            try { renderEmbed(fig, items); anyRendered = true; }
                            catch (e) { jpeWarn('safety re-render failed', e); }
                        }
                        if (anyRendered) clearInterval(poll);
                    }, 500);
                })();
            } catch (e) { jpeWarn('cache-prime failed (non-fatal)', e); }
        } catch (ex) {
            jpeErr(ex);
            setJpeStatus('Failed: ' + (ex.message || ex), 'err');
        }
    });
}

document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var expanded = document.querySelectorAll('.jpe-thumb.jpe-expanded');
    if (!expanded.length) return;
    expanded.forEach(function (el) {
        el.classList.remove('jpe-expanded');
        var parent = el.closest('.jpe-embed');
        if (parent) parent.classList.remove('jpe-embed-expanded');
    });
    document.querySelectorAll('.jpe-hover-preview').forEach(function (p) { p.remove(); });
    e.preventDefault();
});

function setupBlockquoteReaddObserver() {
    var obs = new MutationObserver(function (muts) {
        var bqsToRefill = new Set();
        for (var i = 0; i < muts.length; i++) {
            var m = muts[i];
            if (!m.target || m.target.tagName !== 'BLOCKQUOTE') continue;

            var saw = false;
            for (var j = 0; j < m.removedNodes.length; j++) {
                var n = m.removedNodes[j];
                if (n.nodeType !== 1 || !n.classList) continue;
                if (n.classList.contains('jpe-text-embed') ||
                    n.classList.contains('mgc-image-secret')) {
                    saw = true; break;
                }
            }
            if (saw) bqsToRefill.add(m.target);
        }
        bqsToRefill.forEach(function (bq) {
            try { _jpeReaddEmbedTextToBlockquote(bq); } catch (e) {}
        });
    });
    obs.observe(document.body, { childList: true, subtree: true });
    jpeLog('blockquote re-add observer attached');
}

function _jpeReaddEmbedTextToBlockquote(bq) {
    var pc = bq.parentElement;
    if (!pc) return;
    var fig = pc.querySelector(':scope > figure');
    if (!fig) return;
    var a = fig.querySelector('a[href]');
    if (!a) return;
    var url;
    try { url = new URL(a.getAttribute('href'), location.href); } catch (e) { return; }

    var jpeItems = g_jpeScannedUrls.get(url.href);
    if (jpeItems && jpeItems.length) {
        var norm = jpeItems.map(function (it) {
            return typeof it === 'string' ? { kind: 'url', value: it } : it;
        });
        for (var i = 0; i < norm.length; i++) {
            var it = norm[i];
            if (it.kind !== 'text') continue;

            var existing = bq.querySelectorAll(':scope > .jpe-text-embed');
            var dup = false;
            for (var k = 0; k < existing.length; k++) {
                if (existing[k].textContent === it.value) { dup = true; break; }
            }
            if (dup) continue;
            var t = document.createElement('div');
            t.className = 'jpe-text-embed';
            t.textContent = it.value;
            bq.appendChild(t);
        }
    }

    var msg = mgcSecretCache[url.href];
    if (msg && typeof msg === 'string') {
        var existingSecret = bq.querySelector(':scope > .mgc-image-secret');
        if (!existingSecret) {
            var d = document.createElement('div');
            d.className = 'sekrit_text mgc-image-secret';
            d.textContent = msg;
            bq.appendChild(d);
        }
    }
}

function setupJpeScanner() {
    try { scanRoot(document); } catch (e) { jpeWarn('initial scanRoot failed', e); }

    var obs = new MutationObserver(function (muts) {
        var figuresToScan = new Set();
        for (var i = 0; i < muts.length; i++) {
            var added = muts[i].addedNodes;
            for (var j = 0; j < added.length; j++) {
                var n = added[j];
                if (n.nodeType !== 1) continue;
                try { scanRoot(n); } catch (e) {}
                if (n.closest) {
                    var f = n.closest('figure');
                    if (f) figuresToScan.add(f);
                }
            }
            var t = muts[i].target;
            if (t && t.closest) {
                var f2 = t.closest('figure');
                if (f2) figuresToScan.add(f2);
            }
        }
        figuresToScan.forEach(function (f) { try { scanFigure(f); } catch (e) {} });
    });

    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'src'] });
    jpeLog('JPE scanner attached');
}

function mgcIsListingPage() {
    var p = (typeof location !== 'undefined' && location.pathname) || "";
    if (/^\/[^\/]+\/?$/.test(p)) return true;
    if (/^\/[^\/]+\/catalog\/?$/.test(p)) return true;
    return false;
}

function mgcHideThreadForSubject(opArticle, label) {
    if (!opArticle || opArticle.dataset.mgcSubjectHidden) return;
    opArticle.dataset.mgcSubjectHidden = "1";
    var hiddenSiblings = [];
    var sib = opArticle.nextElementSibling;
    while (sib && sib.tagName === "ARTICLE" && !sib.classList.contains("op")) {
        sib.style.display = "none";
        sib.dataset.mgcSubjectHiddenChild = "1";
        hiddenSiblings.push(sib);
        sib = sib.nextElementSibling;
    }
    opArticle.style.display = "none";
    var stub = document.createElement("div");
    stub.className = "mgc-subject-filter-stub";
    stub.textContent = "Thread filtered (subject:" + label + ") — click to show";
    stub.title = "Click to reveal this thread. Remove the filter entry from the filters textarea to unhide permanently.";
    stub.onclick = function () {
        opArticle.style.display = "";
        delete opArticle.dataset.mgcSubjectHidden;
        for (var i = 0; i < hiddenSiblings.length; i++) {
            hiddenSiblings[i].style.display = "";
            delete hiddenSiblings[i].dataset.mgcSubjectHiddenChild;
        }
        stub.remove();
    };
    opArticle.parentNode.insertBefore(stub, opArticle);
}

function mgcApplySubjectFilterToOp(article) {
    if (!article || !article.classList || !article.classList.contains("op")) return;
    if (!mgcIsListingPage()) return;
    if (article.dataset.mgcSubjectHidden) return;
    var h3 = article.querySelector("h3");
    if (!h3) return;

    var raw = (h3.textContent || "").trim();
    var subject = raw.replace(/^[「]+/, "").replace(/[」]+$/, "").trim();
    if (!subject) return;
    for (var i = 0; i < customFilters.length; i++) {
        if (customFilters[i][0] !== "subject") continue;
        var reg = customFilters[i][1];
        if (subject.match(reg)) {

            var label = reg.source;
            mgcHideThreadForSubject(article, label);
            return;
        }
    }
}

function mgcScanAllOpsForSubject() {
    if (!mgcIsListingPage()) return;
    var ops = document.querySelectorAll("article.op");
    for (var i = 0; i < ops.length; i++) mgcApplySubjectFilterToOp(ops[i]);
}

function mgcSetupSubjectFilterObservers() {
    if (!mgcIsListingPage()) return;
    var hasSubjectFilter = false;
    for (var i = 0; i < customFilters.length; i++) {
        if (customFilters[i][0] === "subject") { hasSubjectFilter = true; break; }
    }
    if (!hasSubjectFilter) return;
    var containerIds = ["thread-container", "threads"];
    for (var c = 0; c < containerIds.length; c++) {
        var container = document.getElementById(containerIds[c]);
        if (!container) continue;

        if (container.dataset.mgcSubjFilterObs) continue;
        container.dataset.mgcSubjFilterObs = '1';
        var obs = new MutationObserver(function (mutations) {
            for (var m = 0; m < mutations.length; m++) {
                var added = mutations[m].addedNodes;
                for (var n = 0; n < added.length; n++) {
                    var node = added[n];
                    if (node.nodeType !== 1) continue;
                    if (node.tagName === "ARTICLE" && node.classList.contains("op")) {
                        mgcApplySubjectFilterToOp(node);
                    } else if (node.querySelectorAll) {
                        var nested = node.querySelectorAll("article.op");
                        for (var k = 0; k < nested.length; k++) mgcApplySubjectFilterToOp(nested[k]);
                    }
                }
            }
        });
        obs.observe(container, { childList: true, subtree: true });
    }
}

function _mgcRegexEscape(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addSubjectToFilter(article) {
    if (!article) return false;
    var h3 = article.querySelector('h3');
    if (!h3) { showToast('No subject to filter'); return false; }
    var raw = (h3.textContent || '').trim();

    var btn = h3.querySelector('.mgc-filter-subject-btn');
    if (btn) raw = raw.replace(btn.textContent || '', '');
    var subject = raw.replace(/^[「]+/, '').replace(/[」]+$/, '').trim();
    if (!subject) { showToast('No subject to filter'); return false; }

    var escaped = _mgcRegexEscape(subject);

    for (var i = 0; i < customFilters.length; i++) {
        if (customFilters[i][0] === 'subject' && customFilters[i][1] && customFilters[i][1].source === escaped) {
            showToast('Subject already filtered');

            mgcScanAllOpsForSubject();
            return false;
        }

        if (customFilters[i][0] === 'subject' && customFilters[i][1] && customFilters[i][1].source === ('\\b' + escaped + '\\b')) {
            showToast('Subject already filtered');
            mgcScanAllOpsForSubject();
            return false;
        }
    }

    try {
        var reg = /^[A-Za-z0-9_]+$/.test(escaped)
            ? new RegExp('\\b' + escaped + '\\b', 'i')
            : new RegExp(escaped);
        customFilters.push(['subject', reg]);
    } catch (e) {
        showToast("Couldn't build filter regex");
        return false;
    }

    var line = 'subject:' + escaped;
    if (customFilterText.indexOf(line) === -1) {
        if (!customFilterText.endsWith('\n')) customFilterText += '\n';
        customFilterText += line + '\n';
        setFunc('customFilterText', customFilterText);
        var ta = document.getElementById('customFilters');
        if (ta) ta.value = customFilterText;
    }

    mgcScanAllOpsForSubject();
    mgcSetupSubjectFilterObservers();
    showToast('Filtered subject: ' + subject.slice(0, 40));
    return true;
}

function mgcAddSubjectFilterButton(article) {
    if (!article || !article.querySelectorAll) return;
    var stale = article.querySelectorAll('.mgc-filter-subject-btn');
    for (var i = 0; i < stale.length; i++) stale[i].remove();
}

function mgcSetupSubjectFilterButtons() {
    if (!mgcIsListingPage()) return;
    var ops = document.querySelectorAll('article.op');
    for (var i = 0; i < ops.length; i++) mgcAddSubjectFilterButton(ops[i]);
    var containerIds = ['thread-container', 'threads'];
    for (var c = 0; c < containerIds.length; c++) {
        var container = document.getElementById(containerIds[c]);
        if (!container) continue;
        var obs = new MutationObserver(function (mutations) {
            for (var m = 0; m < mutations.length; m++) {
                var added = mutations[m].addedNodes;
                for (var n = 0; n < added.length; n++) {
                    var node = added[n];
                    if (node.nodeType !== 1) continue;
                    if (node.tagName === 'ARTICLE' && node.classList.contains('op')) {
                        mgcAddSubjectFilterButton(node);
                    } else if (node.querySelectorAll) {
                        var nested = node.querySelectorAll('article.op');
                        for (var k = 0; k < nested.length; k++) mgcAddSubjectFilterButton(nested[k]);
                    }
                }
            }
        });
        obs.observe(container, { childList: true, subtree: true });
    }
}

function addMD5ToFilter(hash) {
    if (!hash) return false;
    hash = hash.toLowerCase();

    for (var i = 0; i < customFilters.length; i++) {
        if (customFilters[i][0] === "md5" && customFilters[i][1] === hash) {
            showToast("MD5 " + hash.substring(0, 8) + "… is already filtered");
            return false;
        }
    }
    customFilters.push(["md5", hash]);
    var line = "md5:" + hash;
    if (customFilterText.indexOf(line) === -1) {
        if (!customFilterText.endsWith("\n")) customFilterText += "\n";
        customFilterText += line + "\n";
        setFunc("customFilterText", customFilterText);
        var ta = document.getElementById("customFilters");
        if (ta) ta.value = customFilterText;
    }

    var posts = document.getElementsByClassName('post-container');
    for (var k = 0; k < posts.length; k++) applyMD5FilterToPost(posts[k]);
    showToast("Filtered MD5 " + hash.substring(0, 8) + "…");
    return true;
}

function setupMD5FilterMenu() {
    function injectInto(menu) {
        if (!menu) return;
        var article = menu.closest('article')
            || (menu.parentElement && menu.parentElement.closest('article'));
        if (!article) return;

        var subjH3 = article.querySelector(':scope > header h3, :scope > h3');
        var subjText = subjH3 ? (subjH3.textContent || '').replace(/^[「]+/, '').replace(/[」]+$/, '').trim() : '';
        var isOpWithSubject = article.classList && article.classList.contains('op') && !!subjText;
        var hash = mgcExtractMediaHash(article);
        if (!hash && !isOpWithSubject) return;

        var ref = menu.querySelector('li');
        var refClass = ref ? ref.className + ' ' : '';

        if (isOpWithSubject && !menu.querySelector('.mgc-filter-subject-item')) {
            var subjItem = document.createElement('li');
            subjItem.className = refClass + 'mgc-filter-subject-item';
            subjItem.textContent = 'Filter Subject';
            subjItem.title = 'Hide threads with subject: ' + subjText.slice(0, 80);
            subjItem.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                addSubjectToFilter(article);
                try { menu.remove(); } catch (_) {}
            }, true);

            menu.insertBefore(subjItem, menu.firstChild);
        }

        if (!hash) return;

        if (!menu.querySelector('.mgc-filter-md5-item')) {
            var md5Item = document.createElement('li');
            md5Item.className = refClass + 'mgc-filter-md5-item';
            md5Item.textContent = 'Filter MD5';
            md5Item.title = 'SHA1 hash (exact-byte match): ' + hash;
            md5Item.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                addMD5ToFilter(hash);
                try { menu.remove(); } catch (_) {}
            }, true);
            menu.appendChild(md5Item);
        }

        var isImage = !/\.(mp4|webm|mov|m4v|ogg|ogv)(\?|#|$)/i.test(
            (article.querySelector('figure a[href*="/assets/images/src/"]') || {}).href || ''
        );
        if (isImage && !menu.querySelector('.mgc-filter-phash-item')) {
            var phItem = document.createElement('li');
            phItem.className = refClass + 'mgc-filter-phash-item';
            phItem.textContent = 'Filter pHash';
            phItem.title = 'Perceptual hash -- matches similar images even after re-encoding / copy-paste';
            phItem.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                addPhashToFilter(article);
                try { menu.remove(); } catch (_) {}
            }, true);
            menu.appendChild(phItem);
        }
    }

    var obs = new MutationObserver(function (mutations) {
        for (var mi = 0; mi < mutations.length; mi++) {
            var added = mutations[mi].addedNodes;
            for (var ni = 0; ni < added.length; ni++) {
                var n = added[ni];
                if (n.nodeType !== 1) continue;
                if (n.classList && n.classList.contains('popup-menu')) {
                    injectInto(n);
                } else if (n.querySelector) {
                    var inner = n.querySelector('.popup-menu');
                    if (inner) injectInto(inner);
                }
            }
        }
    });
    obs.observe(document.body, { childList: true, subtree: true });
}

const PHASH_HAMMING_THRESHOLD = 10;

var mgcPhashCache = new Map();

var mgcPhashInflight = new Map();

function mgcComputeDHashFromImageData(imageData) {
    var grey = new Array(72);
    for (var i = 0; i < 72; i++) {
        var r = imageData[i * 4];
        var g = imageData[i * 4 + 1];
        var b = imageData[i * 4 + 2];

        grey[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
    var hex = '';
    for (var y = 0; y < 8; y++) {
        var nibble1 = 0, nibble2 = 0;
        for (var x = 0; x < 4; x++) {
            if (grey[y * 9 + x] < grey[y * 9 + x + 1]) nibble1 |= 1 << (3 - x);
        }
        for (var x2 = 4; x2 < 8; x2++) {
            if (grey[y * 9 + x2] < grey[y * 9 + x2 + 1]) nibble2 |= 1 << (7 - x2);
        }
        hex += nibble1.toString(16) + nibble2.toString(16);
    }
    return hex;
}

function mgcHashHamming(a, b) {
    if (!a || !b || a.length !== b.length) return Infinity;
    var d = 0;
    for (var i = 0; i < a.length; i++) {
        var x = (parseInt(a[i], 16) ^ parseInt(b[i], 16)) & 0xf;
        while (x) { d += x & 1; x >>= 1; }
    }
    return d;
}

async function mgcComputePhashForImageUrl(url) {
    return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () {
            try {
                var canvas = document.createElement('canvas');
                canvas.width = 9;
                canvas.height = 8;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, 9, 8);
                var data = ctx.getImageData(0, 0, 9, 8).data;
                resolve(mgcComputeDHashFromImageData(data));
            } catch (e) {
                resolve(null);
            }
        };
        img.onerror = function () { resolve(null); };
        img.src = url;
    });
}

async function mgcGetOrComputePhash(url) {
    if (mgcPhashCache.has(url)) return mgcPhashCache.get(url);
    if (mgcPhashInflight.has(url)) return mgcPhashInflight.get(url);
    var p = mgcComputePhashForImageUrl(url).then(function (h) {
        mgcPhashCache.set(url, h);
        mgcPhashInflight.delete(url);
        return h;
    });
    mgcPhashInflight.set(url, p);
    return p;
}

function mgcGetPostImageUrl(article) {
    if (!article) return null;
    var anchor = article.querySelector('figure a[href*="/assets/images/src/"]');
    return anchor ? anchor.href : null;
}

function mgcApplyPhashHideUI(article, postHash, filterHash) {
    if (currentlyEnabledOptions.has("hidePhashPosts")) {
        if (article.classList.contains("filtered") || article.classList.contains("filtered-shown")) return;
        article.classList.add("filtered");
        var stub = document.createElement("div");
        stub.classList.add("filter-stub");
        stub.innerText = "Post filtered (phash:" + filterHash + ")";
        stub.onclick = showFilteredPost;
        article.appendChild(stub);
        return;
    }
    var fig = article.querySelector('figure');
    if (!fig) return;
    fig.classList.add('mgc-md5-filtered');
    var nextEl = fig.nextElementSibling;
    var alreadyStubbed = nextEl && nextEl.classList && nextEl.classList.contains('mgc-md5-filtered-stub');
    if (!alreadyStubbed) {

        var s = mgcMakeMediaFilterStub(
            '[filtered media (pHash ' + postHash.substring(0, 8) + '…)]',
            'pHash ' + postHash + ' matched filter ' + filterHash + ' (hamming distance check)'
        );
        fig.insertAdjacentElement('afterend', s);
    }
}

async function applyPhashFilterToPost(postContent) {
    if (!postContent) return;
    var filters = [];
    for (var i = 0; i < customFilters.length; i++) {
        if (customFilters[i][0] === "phash") filters.push(customFilters[i][1]);
    }
    if (filters.length === 0) return;
    var article = postContent.parentNode;
    if (!article) return;
    if (article.dataset.mgcPhashHidden) return;
    var url = mgcGetPostImageUrl(article);
    if (!url) return;

    if (/\.(mp4|webm|mov|m4v|ogg|ogv)(\?|#|$)/i.test(url)) return;
    var postHash = await mgcGetOrComputePhash(url);
    if (!postHash) return;
    for (var k = 0; k < filters.length; k++) {
        if (mgcHashHamming(postHash, filters[k]) <= PHASH_HAMMING_THRESHOLD) {
            article.dataset.mgcPhashHidden = '1';
            mgcApplyPhashHideUI(article, postHash, filters[k]);
            return;
        }
    }
}

async function addPhashToFilter(article) {
    var url = mgcGetPostImageUrl(article);
    if (!url) { showToast("No image to pHash"); return false; }
    if (/\.(mp4|webm|mov|m4v|ogg|ogv)(\?|#|$)/i.test(url)) {
        showToast("pHash filter only supports still images");
        return false;
    }
    showToast("Computing pHash…", 2000);
    var hash = await mgcGetOrComputePhash(url);
    if (!hash) { showToast("pHash computation failed"); return false; }

    for (var i = 0; i < customFilters.length; i++) {
        if (customFilters[i][0] === "phash"
            && mgcHashHamming(hash, customFilters[i][1]) <= PHASH_HAMMING_THRESHOLD) {
            showToast("pHash " + hash.substring(0, 8) + "… already filtered");
            return false;
        }
    }
    customFilters.push(["phash", hash]);
    var line = "phash:" + hash;
    if (customFilterText.indexOf(line) === -1) {
        if (!customFilterText.endsWith("\n")) customFilterText += "\n";
        customFilterText += line + "\n";
        setFunc("customFilterText", customFilterText);
        var ta = document.getElementById("customFilters");
        if (ta) ta.value = customFilterText;
    }

    var posts = document.getElementsByClassName('post-container');
    for (var k = 0; k < posts.length; k++) {
        var art = posts[k].parentNode;
        if (art) delete art.dataset.mgcPhashHidden;
        applyPhashFilterToPost(posts[k]);
    }
    showToast("Filtered pHash " + hash.substring(0, 8) + "…");
    return true;
}

function showFilteredPost() {
    var post = this.parentNode;
    if (post.classList.contains("filtered")) {
        post.classList.remove("filtered");
        post.classList.add("filtered-shown");
    } else {
        post.classList.remove("filtered-shown");
        post.classList.add("filtered");
    }
}

function setupStorage() {
    if (typeof GM_setValue === "function") {
        setFunc = GM_setValue;
        getFunc = GM_getValue;
    } else if (typeof GM === "object") {
        setFunc = GM.setValue;
        getFunc = GM.getValue;
    } else {
        setFunc = function () { localStorage.setItem(arguments[0], arguments[1]); };
        getFunc = function () {
            return (localStorage.getItem(arguments[0]) == null) ? arguments[1] : localStorage.getItem(arguments[0]);
        };
        if (getFunc("errorScreenShown") != "true") {
            if (window.confirm("You are not using greasemonkey/tampermonkey/violentmonkey. Please open up an issue at our github to fix this. Specify what userscript manager you are using. Pressing OK will bring you to the page, until then only temporary storage will be used")) {
                window.location.href = "https://github.com/tragsg/megukascript/issues/new";
            }
            setFunc("errorScreenShown", "true");
        }
    }
}

function syncSecretBorderClass() {
    if (!document.body) return;
    if (currentlyEnabledOptions.has("secretBorder")) {
        document.body.classList.add("mgc-secret-border");
    } else {
        document.body.classList.remove("mgc-secret-border");
    }
}

function setup() {
    setupStorage();
    getCurrentOptions();
    insertCuteIntoCSS();
    syncSecretBorderClass();
    readPostsForData();

    mgcInitialLoadDone = true;
    if (document.getElementById("thread-container") != null) {
        setObservers();
    }
    setupSecretMediaTriggers();
    setupMD5FilterMenu();
    hackLatsOptions();
    checkShortcuts();
    if (currentlyEnabledOptions.has("enablemegucaplayer")) mgcPl_setupPlaylist();
    setupJpeScanner();
    setupBlockquoteReaddObserver();

    mgcScanAllOpsForSubject();
    mgcSetupSubjectFilterObservers();

    mgcSetupSubjectFilterButtons();
}

function checkShortcuts() {

    document.addEventListener('keydown', function (e) {
        var path = e.path || (e.composedPath && e.composedPath()) || [];
        var combo = (e.ctrlKey ? 'Ctrl+' : '') + (e.altKey ? 'Alt+' : '') + (e.shiftKey ? 'Shift+' : '') + e.code.replace(/(Key|Digit)/, '');
        var bindsCsv = ',' + keybinds.map(k => k[1]).join(',').toLowerCase() + ',';
        if (e.target.nodeName === 'TEXTAREA' &&
            e.target.parentElement && e.target.parentElement.parentElement &&
            e.target.parentElement.parentElement.className === 'post-container' &&
            bindsCsv.includes(',' + combo.toLowerCase() + ',')) {
            e.preventDefault();
            e.stopPropagation();
            var tagRow = -1;
            for (let i = 0; i < keybinds.length && tagRow < 0; i++) {
                tagRow = (keybinds[i][1].toLowerCase() == combo.toLowerCase() ? i : -1);
            }
            if (tagRow >= 0) {
                var selStart = e.target.selectionStart, selEnd = e.target.selectionEnd;
                e.target.value = e.target.value.slice(0, selStart) + keybinds[tagRow][2] +
                    e.target.value.slice(selStart, selEnd) + keybinds[tagRow][2] +
                    e.target.value.slice(selEnd);
                e.target.setSelectionRange(keybinds[tagRow][2].length + selEnd, keybinds[tagRow][2].length + selEnd);
                let evt = document.createEvent('HTMLEvents');
                evt.initEvent('input', false, true);
                e.target.dispatchEvent(evt);
            }
        } else if (e.target.nodeName === 'INPUT' && path.length == 10 && path[1] && path[1].getAttribute && path[1].getAttribute('data-id') == '4') {
            e.preventDefault();
            e.stopPropagation();
            var kc = (e.keyCode || e.which || 0);
            if (kc == 8 || kc == 27 || kc == 46) {
                e.target.value = '';
                let evt = document.createEvent('HTMLEvents');
                evt.initEvent('input', false, true);
                e.target.dispatchEvent(evt);
            } else if ((kc >= 48 && kc <= 57) || (kc >= 65 && kc <= 90) || (kc >= 96 && kc <= 105) || (kc >= 112 && kc <= 123) || kc == 13) {
                e.target.value = combo;
                setFunc(e.target.id, e.target.value);
                var rowTag = keybinds.map(row => row[0]).indexOf(e.target.id);
                if (rowTag >= 0) keybinds[rowTag][1] = e.target.value;
                let evt = document.createEvent('HTMLEvents');
                evt.initEvent('input', false, true);
                e.target.dispatchEvent(evt);
            }
        }
    }, false);
}

function downloadAll() {
    var thread = document.getElementById("thread-container");
    if (!thread) return;
    var posts = thread.children;
    var filetypes = document.getElementById("steal_filetypes").value.split(" ");
    for (var i = 0; i < posts.length; i++) {
        if (posts[i].tagName.toLowerCase() === "article" && posts[i].querySelector("figcaption") != null) {
            var anchor = posts[i].querySelector("figcaption").children[3];
            if (!anchor) continue;
            for (var j = 0; j < filetypes.length; j++) {
                if (anchor.href.endsWith(filetypes[j])) anchor.click();
            }
        }
    }
}

function overrideDoneButton(postItself) {
    if (document.getElementById("overrided-done-button") || document.getElementsByClassName('spaced temporary')) return;
    var button = document.createElement("input");
    button.name = "over-done";
    button.value = "Done";
    button.type = "button";
    button.id = "overrided-done-button";
    button.onclick = editPostAndSubmit;
    var controls = document.getElementById("post-controls");
    if (!controls) return;
    controls.children[0].style.display = "none";
    controls.insertBefore(button, controls.children[0].nextSibling);
}

function editPostAndSubmit() {
    var input = document.getElementById("text-input");
    handlePreSubmit(input);
    var evt = document.createEvent('HTMLEvents');
    evt.initEvent('input', false, true);
    input.dispatchEvent(evt);
    document.getElementById("post-controls").children[0].click();
}

function handlePreSubmit(input) {  }

const nipponeseIndex = ["ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
    "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんゃゅょ心無日口二手山木糸羽雨辵水金色何"];

function mgcOpenReplyForm() {
    if (document.getElementById('text-input')) return true;
    var replyLink = document.querySelector("aside.posting a");
    if (replyLink) { replyLink.click(); return true; }
    var newThread = document.querySelector("aside:not(.expanded) .new-thread-button");
    if (newThread) { newThread.click(); return true; }
    return false;
}

function mgcWaitForTextInput(timeoutMs) {
    return new Promise(function (resolve) {
        var existing = document.getElementById('text-input');
        if (existing) return resolve(existing);
        var deadline = Date.now() + (timeoutMs || 3000);
        var obs = new MutationObserver(function () {
            var el = document.getElementById('text-input');
            if (el) { obs.disconnect(); resolve(el); }
            else if (Date.now() > deadline) { obs.disconnect(); resolve(null); }
        });
        obs.observe(document.body, { childList: true, subtree: true });
        setTimeout(function () { obs.disconnect(); resolve(document.getElementById('text-input')); }, timeoutMs || 3000);
    });
}

async function secretButtonPressed() {
    var fileInput = document.getElementById("secret_image");
    var file = fileInput.files[0] || fileInput.javascriptIsFuckingDumb;

    if (!document.getElementById('text-input') || !document.querySelector("#post-controls [name=image]")) {
        mgcOpenReplyForm();
    }
    var textInput = await mgcWaitForTextInput(3000);
    if (!textInput) {
        showToast("Couldn't open reply form", 3000);
        return;
    }

    if (!file) {
        var text = btoa(unescape(encodeURIComponent(document.getElementById('hidetext').value)));
        document.getElementById('hidetext').value = '';
        for (var j = 0; j < nipponeseIndex[0].length; j++) {
            if (text.indexOf(nipponeseIndex[0][j]) != -1)
                text = (nipponeseIndex[0][j] == "/" || nipponeseIndex[0][j] == "+")
                    ? text.replace(new RegExp("\\" + nipponeseIndex[0][j], 'g'), nipponeseIndex[1][j])
                    : text.replace(new RegExp(nipponeseIndex[0][j], 'g'), nipponeseIndex[1][j]);
        }
        var encoded = '````' + text + '````\n';
        var start = textInput.selectionStart || 0;
        var end = textInput.selectionEnd || 0;
        textInput.value = textInput.value.substring(0, start) + encoded + textInput.value.substring(end);
        var evt = document.createEvent('HTMLEvents');
        evt.initEvent('input', false, true);
        textInput.dispatchEvent(evt);
        textInput.focus();
        return;
    }

    var te = new TextEncoder();
    var hiddenText = document.getElementById('hidetext').value;
    if (te.encode(hiddenText).length > 999) {
        showToast("secret text too long ;_;", 4000);
        return;
    }
    var hiddenBytes = te.encode(hiddenText);
    var envelope = await _jpeEncryptPayload(hiddenBytes);
    var len = envelope.length.toString();
    while (len.length < 5) len = "0" + len;
    var trailerStr = len + "emsec1";

    var fr = new FileReader();
    fr.onload = function () {
        var buffer = this.result;
        var newfile = new File([buffer, envelope, te.encode(trailerStr)], file.name);
        var realInput = document.querySelector("#post-controls [name=image]");
        if (!realInput) {
            showToast("Couldn't find post file input", 4000);
            return;
        }

        try {
            var dt = new DataTransfer();
            dt.items.add(newfile);
            realInput.files = dt.files;
        } catch (e) {

            realInput.files = [newfile];
        }
        var evt = document.createEvent('HTMLEvents');
        evt.initEvent('change', false, true);
        realInput.dispatchEvent(evt);

        fileInput.value = "";
        fileInput.javascriptIsFuckingDumb = undefined;
        document.getElementById('hidetext').value = '';
    };
    fr.readAsArrayBuffer(file);
}

function parseSecretPost(post, secret) {
    var text = secret[1];
    var before = post.innerHTML.substring(0, secret.index);
    var after = post.innerHTML.substring(secret.index + secret[0].length);

    for (var j = 0; j < nipponeseIndex[0].length; j++) {
        text = text.replace(new RegExp(nipponeseIndex[1][j], 'g'), nipponeseIndex[0][j]);
    }
    var decodedMessage = "";
    try {
        decodedMessage = decodeURIComponent(escape(atob(text)));
    } catch (e) {
        return;
    }
    decodedMessage = decodedMessage.replace(new RegExp("<", 'g'), "<󠁂");
    decodedMessage = decodedMessage.replace(new RegExp(">", 'g'), "󠁂>");
    post.innerHTML = before + "<h class=\"sekrit_text\">" + decodedMessage + "</h>" + after;
}

function parseSecretQuote(post, secretQuote) {
    var quote = secretQuote[1];
    var before2 = post.innerHTML.substring(0, secretQuote.index);
    var after2 = post.innerHTML.substring(secretQuote.index + secretQuote[0].length);
    if (secretQuote[0].substring(secretQuote[0].length - 1) == "<" || secretQuote[0].substring(secretQuote[0].length - 1) == " ") {
        after2 = secretQuote[0].substring(secretQuote[0].length - 1) + after2;
        secretQuote[0] = secretQuote[0].substring(0, secretQuote[0].length - 1);
    }
    quote = "<a class=\"post-link\" data-id=\"" + quote + "\" href=\"#p" + quote + "\">&gt;&gt;" + quote + "</a><a class=\"hash-link\" href=\"#p" + quote + "\"> #</a>";
    post.innerHTML = before2 + " </h>" + quote + after2;
}

function addMessageToPost(thumbHref, message) {
    var thumbs = document.querySelectorAll("figure > a[href$='" + thumbHref + "']");
    for (var i = 0; i < thumbs.length; i++) {
        var thumb = thumbs[i];
        var figure = thumb.parentNode;
        if (!figure) continue;
        if (figure.dataset.mgcSecretAdded) continue;
        figure.dataset.mgcSecretAdded = '1';

        var container = figure.parentNode;
        if (!container) continue;
        var bq = container.querySelector('blockquote');
        if (!bq) continue;
        var div = document.createElement("div");
        div.className = "sekrit_text mgc-image-secret";
        div.textContent = message;
        bq.appendChild(div);
        handlePost(container);
    }
}

var mgcSecretCache = {};
var mgcScanInflight = {};

function maybeScanNewPostForSecretMedia(post) {

}

async function scanPostForSecretMedia(post) {
    if (!post) return;
    var fig = post.querySelector("figure") || (post.parentNode && post.parentNode.querySelector("figure"));
    if (!fig) return;
    var thumbLink = fig.querySelector("a");
    if (!thumbLink || !thumbLink.href) return;
    await scanMediaUrl(thumbLink.href, fig);
}

async function scanMediaUrl(fullUrl, knownFig, userTriggered) {
    if (!currentlyEnabledOptions.has("imgsekritPosting")) return;
    if (!fullUrl) return;
    if (!/\.(jpe?g|png|gif|webp|bmp|mp4|webm|mov|m4v|ogg|ogv)(\?|#|$)/i.test(fullUrl)) return;

    var pathOnly;
    try { pathOnly = new URL(fullUrl, window.location.origin).pathname; } catch (e) { return; }

    if (mgcSecretCache[fullUrl] !== undefined) {
        if (mgcSecretCache[fullUrl]) addMessageToPost(pathOnly, mgcSecretCache[fullUrl]);
        return;
    }
    if (mgcScanInflight[fullUrl]) return;

    if (knownFig && knownFig.dataset && knownFig.dataset.mgcSecretAdded) {
        mgcSecretCache[fullUrl] = null;
        return;
    }
    mgcScanInflight[fullUrl] = true;
    try {
        var tail = await fetchTailBytes(fullUrl, 1008, userTriggered);
        if (!tail) { mgcSecretCache[fullUrl] = null; return; }
        var str = "";
        for (var i = 0; i < tail.byteLength; i++) str += String.fromCharCode(tail[i]);
        if (str.substring(str.length - 6) !== "secret") {
            mgcSecretCache[fullUrl] = null;
            return;
        }
        var length = parseInt(str.substring(str.length - 9, str.length - 6), 10);
        if (isNaN(length) || length <= 0 || length > tail.byteLength - 9) {
            mgcSecretCache[fullUrl] = null;
            return;
        }
        var msgBytes = tail.slice(tail.byteLength - 9 - length, tail.byteLength - 9);
        var message = new TextDecoder().decode(msgBytes);
        mgcSecretCache[fullUrl] = message;
        addMessageToPost(pathOnly, message);
    } catch (e) {
        mgcSecretCache[fullUrl] = null;
    } finally {
        delete mgcScanInflight[fullUrl];
    }
}

const MGC_MAX_SCAN_BYTES = 8 * 1024 * 1024;

async function fetchTailBytes(url, tailLen, userTriggered) {
    try {

        var u = await jpeSharedFetch(url);
        if (!u) return null;
        if (!userTriggered && u.byteLength > MGC_MAX_SCAN_BYTES) return null;
        return u.byteLength > tailLen ? u.slice(u.byteLength - tailLen) : u;
    } catch (e) {
        return null;
    }
}

function setupSecretMediaTriggers() {

    var overlay = document.getElementById("hover-overlay");
    if (overlay) {
        var obs = new MutationObserver(function (mutations) {
            for (var k = 0; k < mutations.length; k++) {
                var added = mutations[k].addedNodes;
                for (var j = 0; j < added.length; j++) {
                    var node = added[j];
                    if (!node) continue;
                    var src = (node.nodeName === "IMG" || node.nodeName === "VIDEO" || node.nodeName === "SOURCE")
                        ? node.src
                        : (node.querySelector ? (node.querySelector("img,video,source") || {}).src : null);
                    if (src) scanMediaUrl(src, null, true);
                }
            }
        });
        obs.observe(overlay, { childList: true, subtree: true });
    }

    document.addEventListener('click', function (e) {
        if (!currentlyEnabledOptions.has("imgsekritPosting")) return;
        var anchor = e.target.closest && e.target.closest("figure a, figcaption a[download]");
        if (!anchor || !anchor.href) return;
        var fig = anchor.closest("figure") || anchor.parentNode;
        scanMediaUrl(anchor.href, fig, true);
    }, true);
}

var mgcPl_songs = [];
var mgcPl_meguca_player;
var mgcPl_currentIndex = -1;
var mgcPl_volume = 1.0;
var mgcPl_seekerBar_updater;
var mgcPl_setupDone = false;
var mgcPl_dragState = null;
var mgcPl_resizeState = null;

var mgcPl_snap = { x: null, y: null };
const MGC_SNAP_THRESHOLD = 40;

function mgcPl_getBannerHeight() {
    var b = document.getElementById('banner');
    if (b && b.offsetHeight) {
        var rect = b.getBoundingClientRect();
        return Math.max(0, rect.bottom);
    }
    return 0;
}

function mgcPl_viewport() {
    var de = document.documentElement;
    return {
        w: (de && de.clientWidth) || window.innerWidth,
        h: (de && de.clientHeight) || window.innerHeight
    };
}

function mgcPl_avoidNekoTV() {
    var watch = document.getElementById('watch-panel');
    if (!watch) return;
    var fr = document.getElementById('mgcPlFrame');
    if (!fr || fr.style.display === 'none' || fr.offsetWidth === 0) return;
    var wr = watch.getBoundingClientRect();
    if (wr.width === 0 || wr.height === 0) return;
    var pr = fr.getBoundingClientRect();
    var overlapX = pr.left < wr.right && pr.right > wr.left;
    var overlapY = pr.top < wr.bottom && pr.bottom > wr.top;
    if (!(overlapX && overlapY)) return;
    var newTop = wr.bottom + 4;
    var maxTop = window.innerHeight - fr.offsetHeight;
    if (newTop > maxTop) newTop = maxTop;
    fr.style.top = Math.max(mgcPl_getBannerHeight(), newTop) + 'px';
    fr.style.bottom = 'auto';
    if (mgcPl_snap.y === 'top' || mgcPl_snap.y === 'middle') mgcPl_snap.y = null;
}

function mgcPl_InsertHtmlAndCSS() {
    var frame = document.createElement("div");
    frame.id = "mgcPlFrame";
    frame.innerHTML =
        '<div class="mgcPlResize mgcPlResizeT"></div>' +
        '<div class="mgcPlResize mgcPlResizeB"></div>' +
        '<div class="mgcPlResize mgcPlResizeL"></div>' +
        '<div class="mgcPlResize mgcPlResizeR"></div>' +
        '<div class="mgcPlResize mgcPlResizeTL"></div>' +
        '<div class="mgcPlResize mgcPlResizeTR"></div>' +
        '<div class="mgcPlResize mgcPlResizeBL"></div>' +
        '<div class="mgcPlResize mgcPlResizeBR"></div>' +
        '<div id="mgcPldragArea">' +
        '  <span class="mgcPlGrip" title="Drag">⋮⋮</span>' +
        '  <span class="mgcPlTitle">MegucaPlayer</span>' +
        '  <span class="mgcPlClose" id="mgcPlCloseBtn" title="Hide">×</span>' +
        '</div>' +
        '<div class="mgcPlControlsRow">' +
        '  <button class="mgcPlBtn" id="mgcPlPrevBut">⏮ Prev</button>' +
        '  <button class="mgcPlBtn" id="mgcPlStopBut">⏹ Stop</button>' +
        '  <button class="mgcPlBtn" id="mgcPlPlayBut">⏯ Play</button>' +
        '  <button class="mgcPlBtn" id="mgcPlNextBut">⏭ Next</button>' +
        '</div>' +
        '<div class="mgcPlSliderRow"><label>⏱</label><input type="range" min="0" max="1" value="0" id="mgcPlSeekerSlider"></div>' +
        '<div class="mgcPlSliderRow"><label>🔊</label><input type="range" min="0" max="100" value="100" id="mgcPlVolumeSlider"></div>' +
        '<div id="megucaplaylist" tabindex="0"></div>';
    if (!currentlyEnabledOptions.has("megucaplayerOption")) frame.style.display = "none";
    document.body.appendChild(frame);
}

function mgcPl_detectSnap(left, top, w, h) {
    var sx = null, sy = null;
    var bannerH = mgcPl_getBannerHeight();
    var vp = mgcPl_viewport();
    if (left < MGC_SNAP_THRESHOLD) sx = 'left';
    else if (vp.w - (left + w) < MGC_SNAP_THRESHOLD) sx = 'right';
    if (top - bannerH < MGC_SNAP_THRESHOLD) sy = 'top';
    else if (vp.h - (top + h) < MGC_SNAP_THRESHOLD) sy = 'bottom';
    return { x: sx, y: sy };
}

function mgcPl_applySnap() {
    var fr = document.getElementById('mgcPlFrame');
    if (!fr) return;
    fr.style.right = 'auto';
    fr.style.bottom = 'auto';
    var w = fr.offsetWidth, h = fr.offsetHeight;
    var bannerH = mgcPl_getBannerHeight();
    var vp = mgcPl_viewport();
    if (mgcPl_snap.x === 'right') fr.style.left = Math.max(0, vp.w - w) + 'px';
    else if (mgcPl_snap.x === 'left') fr.style.left = '0px';
    if (mgcPl_snap.y === 'bottom') fr.style.top = Math.max(bannerH, vp.h - h) + 'px';
    else if (mgcPl_snap.y === 'top') fr.style.top = bannerH + 'px';
    else if (mgcPl_snap.y === 'middle') {
        var freeH = vp.h - bannerH;
        fr.style.top = Math.max(bannerH, bannerH + (freeH - h) / 2) + 'px';
    }
    mgcPl_avoidNekoTV();
}

function mgcPl_saveAll() {
    var fr = document.getElementById('mgcPlFrame');
    if (!fr) return;
    setFunc('mgcPl_pos_left', fr.style.left);
    setFunc('mgcPl_pos_top', fr.style.top);
    setFunc('mgcPl_size_width', fr.style.width || (fr.offsetWidth + 'px'));
    setFunc('mgcPl_size_height', fr.style.height || (fr.offsetHeight + 'px'));
    setFunc('mgcPl_snap_x', mgcPl_snap.x || '');
    setFunc('mgcPl_snap_y', mgcPl_snap.y || '');
}

function mgcPl_attachDrag() {
    var dragHandle = document.getElementById('mgcPldragArea');
    var frame = document.getElementById('mgcPlFrame');
    if (!dragHandle || !frame) return;

    function onMouseDown(ev) {
        if (ev.target.id === 'mgcPlCloseBtn') return;
        ev.preventDefault();
        var rect = frame.getBoundingClientRect();

        frame.style.left = rect.left + 'px';
        frame.style.top = rect.top + 'px';
        frame.style.right = 'auto';
        frame.style.bottom = 'auto';
        mgcPl_dragState = {
            offsetX: ev.clientX - rect.left,
            offsetY: ev.clientY - rect.top
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        frame.style.transition = 'none';
    }
    function onMouseMove(ev) {
        if (!mgcPl_dragState) return;
        var bannerH = mgcPl_getBannerHeight();
        var vp = mgcPl_viewport();
        var x = ev.clientX - mgcPl_dragState.offsetX;
        var y = ev.clientY - mgcPl_dragState.offsetY;
        x = Math.max(0, Math.min(vp.w - frame.offsetWidth, x));

        y = Math.max(bannerH, Math.min(vp.h - frame.offsetHeight, y));
        frame.style.left = x + 'px';
        frame.style.top = y + 'px';
    }
    function onMouseUp() {
        mgcPl_dragState = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        var rect = frame.getBoundingClientRect();
        mgcPl_snap = mgcPl_detectSnap(rect.left, rect.top, rect.width, rect.height);
        mgcPl_applySnap();
        mgcPl_saveAll();
    }
    dragHandle.addEventListener('mousedown', onMouseDown);

    window.addEventListener('resize', function () {
        if (mgcPl_dragState || mgcPl_resizeState) return;
        mgcPl_applySnap();
    });
}

function mgcPl_attachResize() {
    var frame = document.getElementById('mgcPlFrame');
    if (!frame) return;

    var handlesMap = {
        'mgcPlResizeT':  { x: 0, y: -1 },
        'mgcPlResizeB':  { x: 0, y:  1 },
        'mgcPlResizeL':  { x: -1, y: 0 },
        'mgcPlResizeR':  { x:  1, y: 0 },
        'mgcPlResizeTL': { x: -1, y: -1 },
        'mgcPlResizeTR': { x:  1, y: -1 },
        'mgcPlResizeBL': { x: -1, y:  1 },
        'mgcPlResizeBR': { x:  1, y:  1 }
    };

    var minW = 240, minH = 220;

    function startResize(dir, ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var rect = frame.getBoundingClientRect();
        frame.style.right = 'auto';
        frame.style.bottom = 'auto';
        frame.style.left = rect.left + 'px';
        frame.style.top = rect.top + 'px';
        frame.style.width = rect.width + 'px';
        frame.style.height = rect.height + 'px';
        mgcPl_resizeState = {
            dir: dir,
            startX: ev.clientX, startY: ev.clientY,
            startW: rect.width, startH: rect.height,
            startL: rect.left, startT: rect.top
        };
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', endResize);
    }
    function doResize(ev) {
        if (!mgcPl_resizeState) return;
        var s = mgcPl_resizeState;
        var dx = ev.clientX - s.startX;
        var dy = ev.clientY - s.startY;
        var w = s.startW, h = s.startH, l = s.startL, t = s.startT;
        var bannerH = mgcPl_getBannerHeight();

        var vp = mgcPl_viewport();
        if (s.dir.x === 1) {
            w = Math.max(minW, s.startW + dx);
            if (l + w > vp.w) w = vp.w - l;
        } else if (s.dir.x === -1) {
            var nw = s.startW - dx;
            if (nw < minW) { dx = s.startW - minW; nw = minW; }
            w = nw;
            l = s.startL + dx;
            if (l < 0) { w += l; l = 0; }
        }

        if (s.dir.y === 1) {
            h = Math.max(minH, s.startH + dy);
            if (t + h > vp.h) h = vp.h - t;
        } else if (s.dir.y === -1) {
            var nh = s.startH - dy;
            if (nh < minH) { dy = s.startH - minH; nh = minH; }
            h = nh;
            t = s.startT + dy;
            if (t < bannerH) { h += (t - bannerH); t = bannerH; }
        }

        frame.style.width = w + 'px';
        frame.style.height = h + 'px';
        frame.style.left = l + 'px';
        frame.style.top = t + 'px';
    }
    function endResize() {
        mgcPl_resizeState = null;
        document.removeEventListener('mousemove', doResize);
        document.removeEventListener('mouseup', endResize);

        var rect = frame.getBoundingClientRect();
        mgcPl_snap = mgcPl_detectSnap(rect.left, rect.top, rect.width, rect.height);
        mgcPl_applySnap();
        mgcPl_saveAll();
    }

    Object.keys(handlesMap).forEach(function (cls) {
        var el = frame.querySelector('.' + cls);
        if (el) el.addEventListener('mousedown', function (ev) {
            startResize(handlesMap[cls], ev);
        });
    });
}

function mgcPl_observeNekoTV() {
    var watch = document.getElementById('watch-panel');
    if (watch && window.ResizeObserver) {
        new ResizeObserver(function () { mgcPl_avoidNekoTV(); }).observe(watch);
    }

    var bodyObs = new MutationObserver(function () {
        var w = document.getElementById('watch-panel');
        if (w && !w._mgcWatched) {
            w._mgcWatched = true;
            if (window.ResizeObserver) new ResizeObserver(function () { mgcPl_avoidNekoTV(); }).observe(w);
        }
        mgcPl_avoidNekoTV();
    });
    bodyObs.observe(document.body, { attributes: true, attributeFilter: ['class'], childList: true });
}

function mgcPl_optionClicked() {

    var checked = document.getElementById("megucaplayerOption").checked;
    if (checked) {
        if (!mgcPl_setupDone) {

            mgcPl_setupPlaylist();
        }
        var frame = document.getElementById("mgcPlFrame");
        if (frame) {
            frame.style.display = "block";

            mgcPl_songs = [];
            var pl = document.getElementById("megucaplaylist");
            if (pl) pl.innerHTML = "";
            mgcPl_fetchAllSongs();
            mgcPl_restoreLayout(frame);
            clearInterval(mgcPl_seekerBar_updater);
            mgcPl_seekerBar_updater = setInterval(mgcPl_updateSeekerBar, 1000);
        }
    } else {
        mgcPl_stopPlayer();
        if (mgcPl_meguca_player !== null && mgcPl_meguca_player !== undefined) mgcPl_meguca_player.src = "";
        var fr = document.getElementById("mgcPlFrame");
        if (fr) fr.style.display = "none";
        clearInterval(mgcPl_seekerBar_updater);
    }
}

function mgcPl_enableToggled(enabled) {
    if (enabled) {
        if (!mgcPl_setupDone) mgcPl_setupPlaylist();
        var frame = document.getElementById("mgcPlFrame");
        if (frame && currentlyEnabledOptions.has("megucaplayerOption")) frame.style.display = "block";
    } else {
        mgcPl_stopPlayer();
        if (mgcPl_meguca_player) mgcPl_meguca_player.src = "";
        var fr = document.getElementById("mgcPlFrame");
        if (fr) fr.style.display = "none";
        clearInterval(mgcPl_seekerBar_updater);
    }
}

var mgcPl_selectedIndex = -1;
function mgcPl_setSelected(idx) {
    var pl = document.getElementById("megucaplaylist");
    if (!pl) return;
    var rows = pl.querySelectorAll('.mgcPlSong');
    for (var i = 0; i < rows.length; i++) rows[i].classList.toggle('mgcPlSelected', i === idx);
    mgcPl_selectedIndex = idx;
}
function mgcPl_playSelected() {
    if (mgcPl_selectedIndex < 0) return;
    mgcPl_play(mgcPl_selectedIndex);
}

function mgcPl_removeSong(idx) {
    if (idx < 0 || idx >= mgcPl_songs.length) return;
    var wasPlaying = (idx === mgcPl_currentIndex);
    mgcPl_songs.splice(idx, 1);
    var pl = document.getElementById("megucaplaylist");
    if (pl) {
        var rows = pl.querySelectorAll('.mgcPlSong');
        if (rows[idx]) rows[idx].remove();

        var remaining = pl.querySelectorAll('.mgcPlSong');
        for (var i = 0; i < remaining.length; i++) remaining[i].dataset.jpeSongIndex = i.toString();
    }
    if (wasPlaying) {
        mgcPl_stopPlayer();
        mgcPl_currentIndex = -1;
    } else if (idx < mgcPl_currentIndex) {
        mgcPl_currentIndex--;
    }
    if (idx === mgcPl_selectedIndex) {
        mgcPl_selectedIndex = -1;
    } else if (idx < mgcPl_selectedIndex) {
        mgcPl_selectedIndex--;
    }
    mgcPl_setSelected(mgcPl_selectedIndex);
}

function mgcPl_play(selectedIndex) {
    if (selectedIndex < 0 || selectedIndex >= mgcPl_songs.length) return;
    if (selectedIndex != mgcPl_currentIndex) {
        mgcPl_killPlayer();
        mgcPl_meguca_player = new Audio(mgcPl_songs[selectedIndex][2]);
        mgcPl_currentIndex = selectedIndex;
        mgcPl_meguca_player.addEventListener("ended", function () { mgcPl_playSong(1); });
        mgcPl_meguca_player.volume = mgcPl_volume;

        var seeker = document.getElementById("mgcPlSeekerSlider");
        if (seeker) {
            seeker.min = 0;

            var guess = mgcPl_convertLengthToSecs(mgcPl_songs[selectedIndex][1]);
            seeker.max = guess > 0 ? guess : 1;
            seeker.value = 0;
        }

        mgcPl_meguca_player.addEventListener('loadedmetadata', function () {
            var s = document.getElementById('mgcPlSeekerSlider');
            if (!s) return;
            var d = mgcPl_meguca_player.duration;
            if (typeof d === 'number' && isFinite(d) && d > 0) s.max = d;
        });
    } else if (!mgcPl_meguca_player.paused) {
        mgcPl_meguca_player.pause();
        return;
    }

    mgcPl_avoidNekoTV();
    var playPromise = mgcPl_meguca_player.play();
    if (playPromise && playPromise.catch) playPromise.catch(function () { });
}

function mgcPl_stopPlayer() {
    if (mgcPl_meguca_player === null || mgcPl_meguca_player === undefined) return;
    mgcPl_meguca_player.pause();
    mgcPl_meguca_player.currentTime = 0;
}

function mgcPl_playSong(variation) {
    if (mgcPl_songs.length === 0) return;
    if (mgcPl_meguca_player !== null && mgcPl_meguca_player !== undefined) {
        mgcPl_meguca_player.pause();
    }
    var nextIndex = ((mgcPl_currentIndex + variation) % mgcPl_songs.length + mgcPl_songs.length) % mgcPl_songs.length;
    mgcPl_setSelected(nextIndex);
    mgcPl_play(nextIndex);
}

function mgcPl_killPlayer() {
    if (mgcPl_meguca_player !== null && mgcPl_meguca_player !== undefined) {
        mgcPl_meguca_player.pause();
        mgcPl_meguca_player.src = "";
    }
}

function mgcPl_fetchAllSongs() {
    var fileinfos = document.getElementsByTagName("figcaption");
    for (var i = 0; i < fileinfos.length; i++) {
        mgcPl_addNewSong(fileinfos[i]);
    }
}

const MGC_AUDIO_EXT = /\.(mp3|flac|wav|opus)(\?|#|$)/i;
const MGC_VIDEO_EXT = /\.(mp4|webm|mov|m4v|m4a|ogg|oga|ogv)(\?|#|$)/i;
const MGC_MUSIC_KEYWORDS = /\bsong|sing(ing)?\b|\bost\b|\balbum\b|\bmusic/i;

function mgcPl_addNewSong(figcaption) {
    if (figcaption === null || figcaption === undefined) return;
    var dlAnchor = figcaption.querySelector("a[download]") || figcaption.children[3];
    if (!dlAnchor || !dlAnchor.href) return;
    var link = dlAnchor.href;
    if (mgcPl_songs.length > 0 && link === mgcPl_songs[mgcPl_songs.length - 1][2]) return;

    var isAudio = MGC_AUDIO_EXT.test(link);
    var isVideo = !isAudio && MGC_VIDEO_EXT.test(link);
    if (!isAudio && !isVideo) return;

    var artistSpan = figcaption.querySelector(".media-artist");
    var titleSpan = figcaption.querySelector(".media-title");
    var durationSpan = figcaption.querySelector(".media-length, .media-duration");
    var metaSpan = figcaption.querySelector(".media-metadata");

    var name = "";
    if (artistSpan && artistSpan.innerHTML !== "") name = artistSpan.innerHTML + " - ";
    if (titleSpan && titleSpan.innerHTML !== "") name += titleSpan.innerHTML;
    if (name === "" && metaSpan && metaSpan.textContent) name = metaSpan.textContent.trim();
    if (name === "") name = dlAnchor.download || link.split("/").pop();

    if (isVideo) {
        var hay = (name + " " + (dlAnchor.download || "") + " " + link.split("/").pop());
        if (!MGC_MUSIC_KEYWORDS.test(hay)) return;
    }

    var duration = "00:00";
    if (durationSpan && durationSpan.innerHTML) duration = durationSpan.innerHTML;

    mgcPl_songs.push([name, duration, link]);

    var playlist = document.getElementById("megucaplaylist");
    if (!playlist) return;
    var row = document.createElement("div");
    row.className = "mgcPlSong";
    row.dataset.jpeSongIndex = (mgcPl_songs.length - 1).toString();
    var text = document.createElement("span");
    text.className = "mgcPlSongText";
    text.textContent = duration + " | " + name;
    row.appendChild(text);
    var rm = document.createElement("span");
    rm.className = "mgcPlSongRemove";
    rm.textContent = "×";
    rm.title = "Remove from playlist";
    row.appendChild(rm);
    playlist.appendChild(row);
}

function mgcPl_setupPlaylist() {
    if (mgcPl_setupDone) return;

    if (/\/assets\/images\/src\/[0-9a-f]+\.[a-z0-9]+$/i.test(location.pathname)) return;
    mgcPl_InsertHtmlAndCSS();
    mgcPl_attachDrag();
    mgcPl_attachResize();
    mgcPl_observeNekoTV();

    document.getElementById("mgcPlPrevBut").addEventListener("click", function () { mgcPl_playSong(-1); });
    document.getElementById("mgcPlStopBut").addEventListener("click", function () { mgcPl_stopPlayer(); });
    document.getElementById("mgcPlPlayBut").addEventListener("click", function () { mgcPl_playSelected(); });
    document.getElementById("mgcPlNextBut").addEventListener("click", function () { mgcPl_playSong(1); });

    var pl = document.getElementById("megucaplaylist");
    pl.addEventListener("click", function (ev) {
        var rm = ev.target.closest && ev.target.closest('.mgcPlSongRemove');
        if (rm) {
            var row = rm.parentElement;
            var idx = row ? parseInt(row.dataset.jpeSongIndex, 10) : -1;
            if (!isNaN(idx)) mgcPl_removeSong(idx);
            ev.preventDefault();
            ev.stopPropagation();
            return;
        }
        var row2 = ev.target.closest && ev.target.closest('.mgcPlSong');
        if (!row2) return;
        var i = parseInt(row2.dataset.jpeSongIndex, 10);
        if (!isNaN(i)) mgcPl_setSelected(i);
    });
    pl.addEventListener("dblclick", function () { mgcPl_playSelected(); });
    document.getElementById("mgcPlCloseBtn").addEventListener("click", function () {

        var opt = document.getElementById("megucaplayerOption");
        if (opt) { opt.checked = false; opt.dispatchEvent(new Event('change')); }
        mgcPl_optionClicked();
    });

    var volumeSlider = document.getElementById("mgcPlVolumeSlider");

    var savedVol = parseFloat(getFunc('mgcPl_volume'));
    if (!isNaN(savedVol) && savedVol >= 0 && savedVol <= 100) {
        mgcPl_volume = savedVol / 100.0;
        volumeSlider.value = savedVol;
    }
    volumeSlider.addEventListener("input", function () { mgcPl_updateVolume(this.value); });
    var seekerSlider = document.getElementById("mgcPlSeekerSlider");
    seekerSlider.addEventListener("input", function () { mgcPl_seekTo(this.value); });
    if (currentlyEnabledOptions.has("megucaplayerOption")) {
        clearInterval(mgcPl_seekerBar_updater);
        mgcPl_seekerBar_updater = setInterval(mgcPl_updateSeekerBar, 1000);
    }

    mgcPl_fetchAllSongs();

    var frame = document.getElementById("mgcPlFrame");
    if (frame) mgcPl_restoreLayout(frame);

    mgcPl_setupDone = true;
}

function mgcPl_restoreLayout(frame) {
    if (!frame) return;
    var savedW = getFunc('mgcPl_size_width');
    var savedH = getFunc('mgcPl_size_height');
    if (savedW) frame.style.width = savedW;
    if (savedH) frame.style.height = savedH;

    var savedSx = getFunc('mgcPl_snap_x');
    var savedSy = getFunc('mgcPl_snap_y');
    var firstRun = (savedSx === undefined && savedSy === undefined &&
                    !getFunc('mgcPl_pos_left') && !getFunc('mgcPl_pos_top'));
    if (firstRun) {
        mgcPl_snap = { x: 'right', y: 'middle' };
        mgcPl_applySnap();
        return;
    }
    mgcPl_snap = {
        x: savedSx === 'left' || savedSx === 'right' ? savedSx : null,
        y: (savedSy === 'top' || savedSy === 'bottom' || savedSy === 'middle') ? savedSy : null
    };
    if (mgcPl_snap.x || mgcPl_snap.y) {
        var savedLeft = getFunc('mgcPl_pos_left');
        var savedTop = getFunc('mgcPl_pos_top');
        if (savedLeft && !mgcPl_snap.x) frame.style.left = savedLeft;
        if (savedTop && !mgcPl_snap.y) frame.style.top = savedTop;
        mgcPl_applySnap();
    } else {
        var sL = getFunc('mgcPl_pos_left');
        var sT = getFunc('mgcPl_pos_top');
        if (sL) frame.style.left = sL;
        if (sT) frame.style.top = sT;
        frame.style.right = 'auto';
        frame.style.bottom = 'auto';
    }
}

function mgcPl_updateVolume(volume) {
    mgcPl_volume = volume / 100.0;
    if (mgcPl_meguca_player !== null && mgcPl_meguca_player !== undefined)
        mgcPl_meguca_player.volume = volume / 100.0;
    setFunc('mgcPl_volume', volume);
}

function mgcPl_seekTo(time) {
    if (mgcPl_meguca_player !== null && mgcPl_meguca_player !== undefined)
        mgcPl_meguca_player.currentTime = time;
}

function mgcPl_convertLengthToSecs(string) {
    if (!string) return 0;
    var midSign = string.indexOf(":");
    if (midSign < 0) return parseInt(string) || 0;
    var minutes = parseInt(string.substring(0, midSign));
    var seconds = parseInt(string.substring(midSign + 1));
    return (minutes * 60) + seconds;
}

function mgcPl_updateSeekerBar() {
    var slider = document.getElementById("mgcPlSeekerSlider");
    if (!slider) return;
    if (mgcPl_meguca_player === null || mgcPl_meguca_player === undefined) slider.value = 0;
    else slider.value = mgcPl_meguca_player.currentTime;
}

setup();
