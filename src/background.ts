chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.ytlink) {
        getTrack(message.ytlink, message.md);
    }
});
async function downloadTrack(ytlink: string): Promise<GetTrackResponse> {
    try {
        const response = await fetch(`https://public-api.gagecottom.com/track?id=${sanitizeUrl(ytlink)}`, {
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
async function getTrack(ytlink: string, md: MetaResult) {
    downloadTrack(ytlink).then((dtresult) => {
        ytlink = sanitizeUrl(ytlink)
        console.log("fetching track meta");
        getMeta(dtresult.trackdata, dtresult.author, dtresult.filename, ytlink).then((gmresult) => {
            console.log(gmresult);
            getConverted(dtresult.trackdata).then((gcr) => {
                if (gcr === true) {
                    if (gmresult.absoluteMatchFound == true) {
                        setMeta(gmresult.absoluteMatchMeta, dtresult.trackdata).then((smr) => {
                            console.log(smr)
                            fetchCompleteFile(dtresult.trackdata, smr.filename).then(() => {
                                closemessage();
                            });
                        });
                    } else {
                        setMeta(md, dtresult.trackdata).then((smr) => {
                            console.log(smr)
                            fetchCompleteFile(dtresult.trackdata, smr.filename).then(() => {
                                closemessage();
                            });
                        });
                    }
                }
            });
        });
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

async function getMeta(title: string, author: string, filename: string, id: string): Promise<GetMetaResponse> {
    try {
        const response = await fetch(`https://public-api.gagecottom.com/track/meta?ams=true&author=${encodeURIComponent(author).replace(/%20/g, '+')}&title=${encodeURIComponent(filename).replace(/%20/g, '+')}&id=${encodeURIComponent(id)}`, {
            mode: "cors"
        });

        if (!response.ok) {
            throw new Error('Failed to fetch track meta');
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to fetch track meta:', error);
        throw error;
    }
}
async function getConverted(trackUrl: string, st?: number): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        const s3id = trackUrl.replace("https://yt-dl-ui-downloads.s3.us-east-2.amazonaws.com/", "");
        const startTime = st === undefined ? new Date().getTime() : st;
        const w = st === undefined ? 7500 : 5000;

        setTimeout(async () => {
            if (new Date().getTime() > startTime + 120000) {
                resolve(false); // Timeout reached, track not converted
            } else {
                try {
                    const gic = await getIsConverted(s3id);
                    if (gic.converted === true) {
                        resolve(true); // Track is converted
                    } else {
                        const result = await getConverted(s3id, startTime);
                        resolve(result); // Recursively check until conversion or timeout
                    }
                } catch (error) {
                    const result = await getConverted(s3id, startTime);
                    resolve(result); // Recursively check in case of errors
                }
            }
        }, w);
    });
}
async function getIsConverted(trackUrl: string): Promise<TrackConvertedResponse> {
    try {
        const response = await fetch(`https://public-api.gagecottom.com/track/converted?id=${trackUrl}`, {
            mode: "cors"
        });

        if (!response.ok) {
            throw new Error('Failed to get conversion status');
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to get conversion status:', error);
        return {
            converted: false,
            trackdata: '',
        };
    }
}
async function setMeta(m: MetaResult, id: string): Promise<SetMetaResponse> {
    return new Promise<SetMetaResponse>((resolve, reject) => {
        const setMetaRequest: SetMetaRequest = {
            url: id,
            title: m.title,
            artist: m.artist,
            album: m.album,
            albumart: m.albumart
        };
        return fetch("https://public-api.gagecottom.com/track/meta", {
            body: JSON.stringify(setMetaRequest),
            method: 'PUT',
            mode: "cors",
        }).then(response => response.json())
            .then((response) => {
                resolve(response as SetMetaResponse); // Resolve the Promise with the response
            })
            .catch(() => {
                resolve({ filename: "" } as SetMetaResponse); // Resolve with an empty filename in case of error
            });
    });
}
async function fetchCompleteFile(id: string, fn: string): Promise<boolean> {
    chrome.downloads.download({ url: id, filename: fn });
    return true;
}

function sanitizeUrl(ytlink: string): string {
    const reg = new RegExp('https://|www.|music.youtube.com/|youtube.com/|youtu.be/|watch\\?v=|&feature=share', 'g');
    return ytlink.replace(reg, "").split("&")[0];
}
