chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.ytlink) {
        if (message.name) {
            getTrack(message.ytlink, message.name);
        } else {
            getTrack(message.ytlink)
        }
    } else if (message.rules) {
        initRules()
    }
});

function initRules() {
    const RULE = {
        id: 1,
        condition: {
            initiatorDomains: [chrome.runtime.id],
            requestDomains: ['music.youtube.com'],
            resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME, chrome.declarativeNetRequest.ResourceType.SUB_FRAME],
        },
        action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            responseHeaders: [
                { header: 'X-Frame-Options', operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE },
                { header: 'Frame-Options', operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE },
                { header: 'Content-Security-Policy', operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE },
                { header: 'User-Agent', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" },
            ],
        },
    };
    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [RULE.id],
        addRules: [RULE],
    });
}

async function downloadTrack(ytlink: string): Promise<GetTrackResponse> {
    try {
        const response = await fetch(`https://api.gagecottom.com/download?id=${sanitizeUrl(ytlink)}`, {
            mode: "cors"
        });

        if (!response.ok) {
            throw new Error('Failed to fetch track data');
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to fetch track data:', error);
        throw error;
    }
}
async function getTrack(link: string, fn?: string) {
    console.log("sending download track request for: " + link)
    if (fn == null || fn == undefined || fn == "") {
        fn = ""
    }
    downloadTrack(link).then(() => {
        var ytlink = sanitizeUrl(link)
        console.log("polling download status");
        pollStatus(ytlink).then(() => {
            getStatus(ytlink).then((gcr) => {
                console.log("fetching file")
                fetchCompleteFile(gcr.url, fn).then(() => {
                    closemessage();
                    updatePopup(link);
                });
            });

        }).catch(() => {
            console.log("caught error in dl poll")
            sendErrorMessage()
        })
    });
}

async function closemessage() {
    try {
        const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        const activeTab = tabs[0]; // Access the first tab directly

        if (activeTab?.id) {
            chrome.tabs.sendMessage(activeTab.id, { complete: true });
            // Handle the response here
        } else {
            console.error("No active tabs found");
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

async function sendErrorMessage() {
    try {
        const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        const activeTab = tabs[0]; // Access the first tab directly

        if (activeTab?.id) {
            chrome.tabs.sendMessage(activeTab.id, { error: true });
            // Handle the response here
        } else {
            console.error("No active tabs found");
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

function updatePopup(id: string) {
    getFromDB(function (db) {
        var n = db.get(id)
        if (n != null && n != undefined) {
            n.state = "dl_done"
            db.set(id, n)
            chrome.storage.local.set({ "downloaddb": Object.fromEntries(db) })
        }
    })
}

async function pollStatus(ytlink: string, st?: number): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        const startTime = st === undefined ? new Date().getTime() : st;
        const w = st === undefined ? 7500 : 5000;

        setTimeout(async () => {
            if (new Date().getTime() > startTime + 120000) {
                resolve(false); // Timeout reached, track not converted
            } else {
                try {
                    const gic = await getStatus(ytlink);
                    if (gic.done === true) {
                        resolve(true); // Track is converted
                    } else {
                        const result = await pollStatus(ytlink, startTime);
                        resolve(result); // Recursively check until conversion or timeout
                    }
                } catch (error) {
                    const result = await pollStatus(ytlink, startTime);
                    resolve(result); // Recursively check in case of errors
                }
            }
        }, w);
    });
}

async function getStatus(ytlink: string): Promise<DLStatusTrack> {
    try {
        const response = await fetch(`https://api.gagecottom.com/status?id=${ytlink}`, {
            mode: "cors"
        })
        if (!response.ok) {
            throw new Error('Failed to get download status');
        }
        return await response.json();
    } catch (error) {
        console.error('Failed to get get download status:', error)
        return {
            id: "",
            type: "",
            url: "",
            done: false,
            details: {
                downloaded: false,
                converted: false,
                genred: false,
                metaFetched: false,
                metaApplied: false,
            },
        };
    }
}

async function fetchCompleteFile(id: string, fn?: string): Promise<boolean> {
    if (fn == null || fn == undefined || fn == "") {
        fn = sanitizeAWSFileName(id)
    } else {
        var t = sanitizeAWSFileName(id).split(".")
        var ext = t[t.length - 1]
        fn = sanitizeFileName(fn)
        fn = fn.trim() + "." + ext
    }
    console.log(fn)
    chrome.downloads.download({ url: id, filename: fn });
    return true;
}
function sanitizeFileName(fn: string): string {
    const reg1 = new RegExp('[:/<>\:"\\|?*]', 'g')
    fn = fn.replace(reg1, "")
    const reg2 = new RegExp('\\s+', 'g')
    return fn.replace(reg2, " ")
}
function sanitizeUrl(ytlink: string): string {
    const reg = new RegExp('https://|www.|music.youtube.com/|youtube.com/|youtu.be/|watch\\?v=|&feature=share|playlist\\?list=', 'g');
    return ytlink.replace(reg, "").split("&")[0];
}

function sanitizeAWSFileName(url: string) {
    const reg = new RegExp('https://|www.|yt-dl-ui-downloads.s3.us-east-2|.amazonaws.com/', 'g')
    return url.replace(reg, "")
}

function getFromDB(callback: (db: Map<string, YTDetails>) => void) {
    chrome.storage.local.get("downloaddb", function (result) {
        const downloaddb = result.downloaddb;
        if (downloaddb) {
            const db = new Map<string, YTDetails>(Object.entries(downloaddb));
            callback(db);
        } else {
            const db = new Map<string, YTDetails>();
            callback(db);
        }
    });
}
