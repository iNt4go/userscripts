// ==UserScript==
// @name         Secret Attachment
// @namespace    http://tampermonkey.net/
// @version      2025-03-29-patch-26
// @description  Encrypt and embed a secret file via catbox.moe in 4chan posts, allowing others to decode and access the hidden content.
// @author       anon
// @match        https://boards.4chan.org/*
// @match        https://owo.vg/*
// @match        https://awoo.cf/*
// @match        https://arch.b4k.dev/*
// @match        https://ghostarchive.org/archive/*
// @grant        GM_xmlhttpRequest
// @connect      catbox.moe
// @connect      files.catbox.moe
// @connect      fatbox.moe
// @connect      files.fatbox.moe
// ==/UserScript==
/* global BigInt */

// patch
async function bytes() {
  return new Uint8Array(await this.arrayBuffer());
}

for (const C of ['Blob', 'Request', 'Response']) {
  const p = globalThis[C]?.prototype;
  if (p && !p.bytes) p.bytes = bytes;
}

function GM_fetch(url, opt = {}) {
    function parseHeaders(headerStr) {
        const headers = new Headers()
        headerStr.trim().split(/[\r\n]+/).forEach((line) => {
            const [key, value] = line.split(": ")
            if (key && value) headers.append(key, value)
        })
        return headers
    }

    return new Promise((resolve, reject) => {
        const request = GM_xmlhttpRequest({
            url,
            method: opt.method || "GET",
            data: opt.body,
            responseType: "blob",
            onload: res => {
                resolve(new Response(res.response, {
                    status: res.status,
                    headers: parseHeaders(res.responseHeaders)
                }))
            },
            ontimeout: () => reject(new Error("Request timed out")),
            onabort: () => reject(new Error("Request aborted")),
            onerror: () => reject(new Error("Network error. Catbox might be blocking your connection. Try visiting the link directly: " + url)),
            // Add progress tracking
            onprogress: (event) => {
                if (opt.onProgress && event.lengthComputable) {
                    const percent = Math.round((event.loaded / event.total) * 100);
                    opt.onProgress(percent, event.loaded, event.total);
                }
            }
        })
    })
}

function $(tag, ...args) {
    let attributes = {}, children = []
    if (args.length === 1) {
        if (Array.isArray(args[0])) {
            children = args[0]
        } else {
            attributes = args[0]
        }
    } else if (args.length === 2) {
        attributes = args[0]
        children = args[1]
    }
    const element = document.createElement(tag)
    for (const [name, value] of Object.entries(attributes)) {
        if (typeof value === "boolean") {
            if (value) {
                element.setAttribute(name, "")
            }
        } else {
            element.setAttribute(name, value)
        }
    }
    element.append(...children)
    return element
}

function insertAfter(newNode, referenceNode) {
    return referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling)
}

function renameFile(inputElement, fileName) {
    const originalFile = inputElement.files[0]
    const modifiedFile = new File([originalFile], fileName, {
        type: originalFile.type
    })
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(modifiedFile)
    inputElement.files = dataTransfer.files
}

function bigIntFromBytes(bytes) {
    let n = BigInt(bytes[0])
    for (let i = 1; i < bytes.length; ++i) {
        n |= BigInt(bytes[i]) << (BigInt(i) << 3n)
    }
    return n
}

function encode(input, alphabet, minDigits = 1) {
    const length = BigInt(alphabet.length)
    let n = bigIntFromBytes(input)
    let result = ""
    while (n > 0n || result.length < minDigits) {
        result = alphabet[Number(n % length)] + result
        n /= length
    }
    return result
}

function decode(input, alphabet) {
    const length = BigInt(alphabet.length)
    let n = 0n
    for (let i = 0; i < input.length; i++) {
        n = n * length + BigInt(alphabet.indexOf(input[i]))
    }
    const byteCount = n === 0n ? 1 : (n.toString(2).length + 7) >>> 3
    const bytes = new Uint8Array(byteCount)
    for (let i = 0; i < byteCount; i++) {
        bytes[i] = Number(n & 0xFFn)
        n = n >> 8n
    }
    return bytes
}

async function sha256(input, length = 32) {
    return new Uint8Array(await crypto.subtle.digest("sha-256", input), 0 , length)
}

function arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false
    for (let i = 0; i < arr1.length; ++i) {
        if (arr1[i] !== arr2[i]) return false
    }
    return true
}

function basename(input) {
    return input.split("/").pop()
}

function parse(filename) {
    const lastIndex = filename.lastIndexOf(".")
    return lastIndex === -1
        ? { name: filename, ext: "" }
        : { name: filename.slice(0, lastIndex), ext: filename.slice(lastIndex + 1) }
}

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890"

async function embed(key, name) {
    const data = new Uint8Array([...key, ...new TextEncoder().encode(name)])
    const hash = await sha256(data, 4)
    return encode(new Uint8Array([...data, ...hash]), alphabet)
}

async function extract(input) {
    const name = parse(input).name
    if (/^[A-Za-z0-9]+$/.test(name)) {
        const bytes = decode(name, alphabet)
        const [data, hash] = [bytes.slice(0, -4), bytes.slice(-4)]
        if (arraysEqual(await sha256(data, 4), hash)) {
            return {
                key: data.slice(0, 16),
                name: new TextDecoder().decode(data.slice(16))
            }
        }
    }
    return null
}

async function encrypt(data, key) {
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        key,
        { name: "AES-CTR" },
        false,
        ["encrypt"]
    )
    const cipher = await crypto.subtle.encrypt(
        { name: "AES-CTR", counter: new Uint8Array(16), length: 64 },
        cryptoKey,
        data
    )
    return new Blob([cipher])
}

async function uploadFile(file, key) {
    const data = new Uint8Array(await file.arrayBuffer())
    const encryptedFile = await encrypt(data, key)
    const form = new FormData()
    form.set("reqtype", "fileupload")
    form.set("fileToUpload", encryptedFile, file.name)
    return GM_fetch("https://catbox.moe/user/api.php", { method: "POST", body: form }).then(res => res.text())
}

async function downloadFile(file, key, progressCallback, fatbox) {
    const link = `https://files.${fatbox ? 'f' : 'c'}atbox.moe/${file}`;

    console.log(`SecretAttachment: Fetching ${link}`);

    // Catbox blocks vpn from downloading, replace with catbox if not working
    const response = await GM_fetch(link, {
        onProgress: (percent) => {
            if (progressCallback) {
                progressCallback(percent);
            }
        }
    });

    // Check response status code
    if (response.status < 200 || response.status >= 500) {
        throw new Error(`Unexpected response status code ${response.status}`);
    }

    const blob = await response.blob();
    const data = new Uint8Array(await blob.arrayBuffer());
    return encrypt(data, key);
}


function mime(ext) {
    return ({
        "aac": "audio/aac",
        "abw": "application/x-abiword",
        "apng": "image/apng",
        "arc": "application/x-freearc",
        "avif": "image/avif",
        "avi": "video/x-msvideo",
        "azw": "application/vnd.amazon.ebook",
        "bin": "application/octet-stream",
        "bmp": "image/bmp",
        "bz": "application/x-bzip",
        "bz2": "application/x-bzip2",
        "cda": "application/x-cdf",
        "csh": "application/x-csh",
        "css": "text/css",
        "csv": "text/csv",
        "doc": "application/msword",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "eot": "application/vnd.ms-fontobject",
        "epub": "application/epub+zip",
        "gz": "application/gzip",
        "gif": "image/gif",
        "htm": "text/html",
        "html": "text/html",
        "ico": "image/vnd.microsoft.icon",
        "ics": "text/calendar",
        "jar": "application/java-archive",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "js": "text/javascript",
        "json": "application/json",
        "jsonld": "application/ld+json",
        "mid": "audio/midi",
        "midi": "audio/midi",
        "mjs": "text/javascript",
        "mp3": "audio/mpeg",
        "mp4": "video/mp4",
        "mpeg": "video/mpeg",
        "mpkg": "application/vnd.apple.installer+xml",
        "odp": "application/vnd.oasis.opendocument.presentation",
        "ods": "application/vnd.oasis.opendocument.spreadsheet",
        "odt": "application/vnd.oasis.opendocument.text",
        "oga": "audio/ogg",
        "ogv": "video/ogg",
        "ogx": "application/ogg",
        "opus": "audio/ogg",
        "otf": "font/otf",
        "png": "image/png",
        "pdf": "application/pdf",
        "php": "application/x-httpd-php",
        "ppt": "application/vnd.ms-powerpoint",
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "rar": "application/vnd.rar",
        "rtf": "application/rtf",
        "sh": "application/x-sh",
        "svg": "image/svg+xml",
        "tar": "application/x-tar",
        "tif": "image/tiff",
        "tiff": "image/tiff",
        "ts": "video/mp2t",
        "ttf": "font/ttf",
        "txt": "text/plain",
        "vsd": "application/vnd.visio",
        "wav": "audio/wav",
        "weba": "audio/webm",
        "webm": "video/webm",
        "webp": "image/webp",
        "woff": "font/woff",
        "woff2": "font/woff2",
        "xhtml": "application/xhtml+xml",
        "xls": "application/vnd.ms-excel",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xml": "application/xml",
        "xul": "application/vnd.mozilla.xul+xml",
        "zip": "application/zip",
        "3gp": "video/3gpp",
        "3g2": "video/3gpp2",
        "7z": "application/x-7z-compressed"
    })[ext]
}

// Process and handle secret attachments
async function processSecretAttachments(shouldNotify = true) {
    const fileElements = document.querySelectorAll(".fileText a[title]");
    let secretsFound = 0;
    let newSecrets = 0;

    for (const fileLink of fileElements) {
        if (!fileLink.title) continue;

        const filename = fileLink.title;
        const fileTextElement = fileLink.closest('.fileText');
        if (!fileTextElement) continue;

        // First find the direct post container
        const postContainer = fileTextElement.closest('.postContainer, .replyContainer');
        if (!postContainer) continue;

        // Skip if this post has already been processed
        if (postContainer.dataset.secretProcessed === 'true') continue;

        const postMessageElement = postContainer.querySelector('.postMessage');
        if (!postMessageElement) continue;

        const parsedFilename = parse(filename.trim()).name;
        const result = await extract(parsedFilename);

        if (result) {
            secretsFound++;
            newSecrets++;

            // Mark the post as processed
            postContainer.dataset.secretProcessed = 'true';

            // Check if this is a catalog view
            const isCatalog = postContainer.classList.contains('catalog-container') ||
                              window.location.pathname.includes('/catalog');

            // Check if this is an OP post
            const isOP = postContainer.classList.contains('opContainer');

            if (isCatalog) {
                // For catalog view, add highlight ONLY to the catalog-thread container
                const threadContainer = postContainer.closest('.thread, .catalog-thread');
                if (threadContainer) {
                    threadContainer.classList.add('has-secret-attachment');
                }
                // Do NOT add class to the postContainer in catalog view
            }
            else if (isOP) {
                // For OP posts in thread view, add highlight ONLY to thread container
                const threadContainer = postContainer.closest('.thread');
                if (threadContainer) {
                    threadContainer.classList.add('has-secret-attachment');
                }
                // Do NOT add class to the opContainer
            }
            else {
                // For replies, add highlight directly to reply container
                postContainer.classList.add('has-secret-attachment');
            }

            const { key, name } = result;
            const secretLink = $("a", { href: "javascript:void(0)" }, [`secret.${parse(name).ext}`]);
            const filename = secretLink.textContent;
            const secret = $("div", { class: "secretFile", style: "margin-top: 8px; margin-bottom: 4px;" }, ["[", secretLink, "]"]);

            secretLink.addEventListener("click", async function() {
                const originalText = secretLink.textContent;
                secretLink.textContent = 'Loading ' + filename + ' via fatbox... (0%)';

                try {
                    let lastPercent = 0;
                    const file = await downloadFile(name, key, (percent) => {
                        if (percent !== lastPercent) {
                            lastPercent = percent;
                            secretLink.textContent = `Loading ${filename} via fatbox... (${percent}%)`;
                        }
                    }, 1).catch((err) => {
return downloadFile(name, key, (percent) => {
                        if (percent !== lastPercent) {
                            lastPercent = percent;
                            secretLink.textContent = `Loading ${filename} via catbox... (${percent}%)`;
                        }
                    }, 0);
});

                    const type = mime(parse(name).ext.toLowerCase());

                    if (type.startsWith("audio")) {
                        secret.replaceWith($("audio", { src: URL.createObjectURL(file), controls: true, style: "max-width: 100%;" }));
                    } else if (type.startsWith("video")) {
                        secret.replaceWith($("video", { src: URL.createObjectURL(file), controls: true, style: "max-width: 100%;" }));
                    } else if (type.startsWith("image")) {
                        secret.replaceWith($("img", { src: URL.createObjectURL(file), style: "max-width: 100%;" }));
                    } else {
                        secretLink.href = URL.createObjectURL(file);
                        secretLink.download = `${crypto.randomUUID()}.${parse(name).ext}`;
                        secretLink.click();
                    }
                } catch (error) {
                    console.error({script: 'SecretAttachment', error});
                    secretLink.textContent = `Error loading ${filename}. Error logged to console.${error.message ? ' ' + error.message : ''}`;
                }
            });

            insertAfter(secret, postMessageElement);
        }
    }

    // Show notification if new secrets were found and notification is enabled
    if (newSecrets > 0 && shouldNotify) {
        showSecretFoundNotification(secretsFound);
    }

    return secretsFound;
}

// Add styling for secret highlight
function addSecretHighlightStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* Highlight animation for posts with secret attachments */
        @keyframes secretPulse {
            0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.2); }
            70% { box-shadow: 0 0 0 8px rgba(255, 255, 255, 0); }
            100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
        }

        /* Base highlight for thread containers */
        .thread.has-secret-attachment,
        .catalog-thread.has-secret-attachment {
            position: relative !important;
            border: 2px solid #555 !important;
            border-radius: 4px !important;
            box-shadow: 0 0 6px rgba(255, 255, 255, 0.2) !important;
            animation: secretPulse 2s ease-out;
            animation-iteration-count: 1;
            padding: 2px !important;
            margin-bottom: 6px !important;
        }

        /* Base highlight for reply containers */
        .postContainer.has-secret-attachment:not(.opContainer),
        .replyContainer.has-secret-attachment {
            position: relative !important;
            border: 2px solid #444 !important;
            border-radius: 4px !important;
            box-shadow: 0 0 6px rgba(255, 255, 255, 0.2) !important;
            animation: secretPulse 2s ease-out;
            animation-iteration-count: 1;
            padding: 2px !important;
            margin-bottom: 4px !important;
        }

        /* Add a subtle indicator to containers with secrets */
        .has-secret-attachment::before {
            content: "🔒";
            position: absolute;
            top: 2px;
            right: 2px;
            font-size: 14px;
            opacity: 0.8;
            z-index: 100;
        }

        /* Enhance the file text for posts with secrets */
        .thread.has-secret-attachment .fileText,
        .thread.has-secret-attachment .fileInfo,
        .catalog-thread.has-secret-attachment .fileText,
        .catalog-thread.has-secret-attachment .fileInfo,
        .has-secret-attachment .fileText,
        .has-secret-attachment .fileInfo {
            font-weight: bold !important;
        }

        /* Make the secret file link stand out better */
        .secretFile {
            display: inline-block;
            padding: 2px 5px;
            background-color: rgba(0, 0, 0, 0.2);
            border-radius: 3px;
            margin-top: 8px !important;
            margin-bottom: 4px !important;
        }

        .secretFile a {
            color: #fff !important;
            text-decoration: none !important;
        }

        .secretFile a:hover {
            text-decoration: underline !important;
        }
    `;
    document.head.appendChild(style);
}

// Create notification popup when secrets are found
function showSecretFoundNotification(count) {
    // Check if we're in catalog view - we still want notifications there
    const isCatalog = window.location.pathname.includes('/catalog');

    // Remove any existing notification
    const existingNotification = document.getElementById('secret-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create notification element
    const notification = $("div", {
        id: "secret-notification",
        style: `
            position: fixed;
            top: calc(3vh + 30px);
            right: 20px;
            background-color: #000000;
            border: 1px solid #333333;
            border-radius: 4px;
            padding: 10px 15px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            z-index: 9999;
            font-family: arial, sans-serif;
            font-size: 14px;
            color: #ffffff;
            max-width: 300px;
            animation: fadeIn 0.3s ease-out;
        `
    }, [
        $("div", { style: "display: flex; align-items: center; margin-bottom: 5px;" }, [
            $("span", { style: "font-weight: bold; margin-right: auto; color: #ffffff;" }, ["Secret Attachment"]),
            $("span", {
                id: "secret-notification-close",
                style: "cursor: pointer; font-size: 18px; line-height: 14px; color: #999999;"
            }, ["×"])
        ]),
        $("div", {}, [
            count === 1
                ? "1 secret attachment detected on this page."
                : `${count} secret attachments detected on this page.`
        ]),
        $("style", {}, [`
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            #secret-notification-close:hover {
                color: #ffffff;
            }
        `])
    ]);

    // Add to document
    document.body.appendChild(notification);

    // Add close button functionality
    document.getElementById('secret-notification-close').addEventListener('click', () => {
        notification.remove();
    });

    // Auto-remove after 7 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'fadeOut 0.3s ease-in forwards';
            notification.addEventListener('animationend', () => {
                if (notification.parentNode) {
                    notification.remove();
                }
            });
        }
    }, 7000);

    // Add fadeOut animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeOut {
            from { opacity: 1; transform: translateY(0); }
            to { opacity: 0; transform: translateY(-10px); }
        }
    `;
    document.head.appendChild(style);
}

// Create secret attachment UI for the given interface (regular or XT)
function createSecretAttachmentUI(mode) {
    if (mode === 'xt') {
        // Create UI for 4chan XT extension
        const fileActionsContainer = document.getElementById('qr-actions-container');
        if (!fileActionsContainer) return;

        const actionsContainer = document.getElementById('qr-actions');
        if (!actionsContainer) return;

        // Check if our button already exists
        if (document.getElementById('qr-secret-button')) return;

        // Create secret file button
        const secretButton = $("input", {
            type: "button",
            id: "qr-secret-button",
            class: "qr-button",
            value: "Secret",
            title: "Add a secret attachment that only users with the Secret Attachment extension can see"
        });

        // Add secret file input (hidden)
        const secretInput = $("input", {
            type: "file",
            id: "qr-secret-input",
            style: "display: none;"
        });

        // Add a status indicator
        const secretStatus = $("span", {
            id: "qr-secret-status",
            style: "display: none; margin-left: 5px; font-size: 0.8em; color: green;"
        }, ["Secret embedded"]);

        // Insert elements
        actionsContainer.appendChild(secretButton);
        actionsContainer.appendChild(secretInput);
        actionsContainer.appendChild(secretStatus);

        // Handle secret file selection
        secretButton.addEventListener("click", function() {
            secretInput.click();
        });

        secretInput.addEventListener("change", async function() {
            if (!secretInput.files.length) return;

            secretButton.disabled = true;
            secretButton.value = "Uploading...";

            try {
                // Find 4chan XT's file input
                let fileInput = document.querySelector('input[type="file"][name="upfile"]');

                // Quick reply
                if (secretInput.closest('#qr')) {
                    fileInput = await new Promise((resolve) => {
                    document.addEventListener('QRFile', (e) => {
                        fileInput = {files: [e.detail]};

                        resolve({files: [e.detail]});
                    });
                    document.dispatchEvent(new CustomEvent('QRGetFile'));
                    });
                }

                if (!fileInput || !fileInput.files.length || !fileInput.files[0]) {
                    alert("Please select a main file first.");
                    secretButton.disabled = false;
                    secretButton.value = "Secret";
                    return;
                }

                const key = crypto.getRandomValues(new Uint8Array(16));
                const name = basename(await uploadFile(secretInput.files[0], key));
                const filename = await embed(key, name);

                // Bad response from catbox
                if (name.includes('>')) {
                    console.error({reason: 'Bad response', script: 'SecretAttachment', res: name});
                    secretButton.disabled = false;
                    secretButton.value = "Secret";
                    alert(`Catbox returned unexpected filename, could not embed. Your VPN/Tor connection is likely blocked. Response logged to console.`);
                    return;
                }

                // Rename the file in 4chan XT's interface
                const originalFilename = fileInput.files[0].name;
                const ext = parse(originalFilename).ext;
                const newFilename = `${filename}.${ext}`;

                // Update filename in XT's interface
                const filenameInput = document.getElementById('qr-filename');
                if (filenameInput) {
                    filenameInput.value = newFilename;
                    // Trigger change event to notify 4chan XT
                    const event = new Event('change', { bubbles: true });
                    filenameInput.dispatchEvent(event);
                }

                // Additionally, try to rename the actual file if possible
                try {
                    renameFile(fileInput, newFilename);
                } catch (e) {
                    // Fallback if direct rename fails - 4chan XT should still use filenameInput.value
                }

                // Show success indicator
                secretStatus.textContent = "Secret embedded";
                secretStatus.style.display = "inline";

                // Reset secret file input but keep success visible
                const dataTransfer = new DataTransfer();
                secretInput.files = dataTransfer.files;

            } catch (error) {
                alert("Error embedding secret: " + error.message);
            } finally {
                secretButton.disabled = false;
                secretButton.value = "Secret";
            }
        });

    } else {
        // Create UI for regular 4chan interface
        const postFile = document.getElementById("postFile");
        if (!postFile) return;

        const submit = postFile.closest("form").querySelector("input[type='submit']");
        insertAfter($("tr", [
            $("td", ["Secret"]),
            $("td", [
                $("input", {
                    id: "postSecret",
                    name: 'postSecret',
                    type: "file",
                    title: "a PEE succeeder that allows to attach a hidden files in your original file that Secret Attachment extension's anons can see. Done on client side. Supports many files types"
                })
            ])
        ]), postFile.closest("tr"));

        const postSecret = document.getElementById("postSecret");
        postSecret.addEventListener("change", async function() {
            if (!postSecret.files.length) return;

            submit.disabled = true;
            submit.title = 'Secret Attachment embedding...';

            try {
                const key = crypto.getRandomValues(new Uint8Array(16));
                const name = basename(await uploadFile(postSecret.files[0], key));
                const filename = await embed(key, name);
                renameFile(postFile, `${filename}.${parse(postFile.files[0].name).ext}`);

                // Indicate file is embedded
                const blob = new Blob([new Uint8Array(4)], { type: 'application/octet-stream' });
                const newFile = new File([blob], 'Embedded!', { type: 'application/octet-stream' });
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(newFile);
                postSecret.files = dataTransfer.files;
            } catch (error) {
                alert("Error embedding secret: " + error.message);
            } finally {
                submit.disabled = false;
                submit.title = '';
            }
        });
    }
}

(async function() {
    "use strict";

    // Add highlight styles
    addSecretHighlightStyles();

    // Detect whether we're using 4chan XT or regular interface
    const is4chanXT = !!document.getElementById('qr-file-button');

    // Set up the secret file input in the appropriate posting form
    createSecretAttachmentUI(is4chanXT ? 'xt' : 'regular');

    // Process existing posts with notification enabled
    await processSecretAttachments(true);

    // Set up a mutation observer to handle dynamically loaded posts
    const observer = new MutationObserver((mutations) => {
        let shouldProcess = false;

        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.querySelector('.fileText') ||
                            node.classList.contains('fileText') ||
                            node.querySelector('.postContainer, .replyContainer') ||
                            node.classList.contains('postContainer') ||
                            node.classList.contains('replyContainer')) {
                            shouldProcess = true;
                            break;
                        }
                    }
                }

                // Also handle 4chan XT QR appearing dynamically
                if (!shouldProcess && !document.getElementById('qr-secret-button')) {
                    if (document.getElementById('qr-file-button')) {
                        createSecretAttachmentUI('xt');
                    }
                }
            }
            if (shouldProcess) break;
        }

        if (shouldProcess) {
            // Use setTimeout to allow the DOM to stabilize
            setTimeout(() => processSecretAttachments(true), 100);
        }
    });

    // Observe changes to the document body
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();

