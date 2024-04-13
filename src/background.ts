chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.ytlink) {
        getTrack(message.ytlink);
    }
});

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
async function getTrack(ytlink: string) {
    console.log("sending download track request")
    downloadTrack(ytlink).then((dtresult) => {
        ytlink = sanitizeUrl(ytlink)
        console.log("polling download status");
        pollStatus(ytlink).then(() => {
            getStatus(ytlink).then((gcr) => {
                console.log("fetching file")
                fetchCompleteFile(gcr.url).then(() => {
                    closemessage();
                });
            });

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


async function fetchCompleteFile(id: string): Promise<boolean> {
    var fn = sanitizeAWSFileName(id)
    console.log(fn)
    chrome.downloads.download({ url: id, filename: fn });
    return true;
}

function sanitizeUrl(ytlink: string): string {
    const reg = new RegExp('https://|www.|music.youtube.com/|youtube.com/|youtu.be/|watch\\?v=|&feature=share', 'g');
    return ytlink.replace(reg, "").split("&")[0];
}
function sanitizeAWSFileName(url: string) {
    const reg = new RegExp('https://|www.|yt-dl-ui-downloads.s3.us-east-2|.amazonaws.com/', 'g')
    return url.replace(reg, "")
}