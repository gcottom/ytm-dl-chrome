interface FetchTokenResponse {
    token: string;
}

interface GetTrackResponse {
    trackdata: string;
    filename: string;
    author: string;
}

interface GetMetaResponse {
    absoluteMatchFound: boolean;
    absoluteMatchMeta: MetaResult;
    results: any; // Replace 'any' with appropriate types
}

interface SetMetaRequest {
    url: string;
    title: string;
    artist: string;
    album: string;
    albumart: string;
}

interface SetMetaResponse {
    filename: string;
}

interface TrackConvertedResponse {
    converted: boolean;
    trackdata: string;
}
interface MetaResult {
    title: string,
    artist: string,
    album: string,
    albumart: string
}
var bearer = "";

document.onclick = function () {
    checkForLink();
}
setInterval(checkForLink, 500);

function checkForLink() {
    const cpybtn = document.getElementById("copy-button");
    const startat = document.getElementById("start-at-timestamp");
    if (cpybtn && startat) {
        const resLink = (document.getElementById("share-url") as HTMLInputElement).value;
        const dlbtn = document.createElement("button");
        dlbtn.id = "ytdlbtn";
        dlbtn.className = "yt-spec-button-shape-next yt-spec-button-shape-next--filled yt-spec-button-shape-next--call-to-action yt-spec-button-shape-next--size-m";
        const indiv = document.createElement("div");
        indiv.className = "yt-spec-button-shape-next__button-text-content";
        const inspan = document.createElement("span");
        inspan.textContent = "Download";

        dlbtn.onclick = function () {
            triggerDL(resLink);

        }

        if (!document.getElementById("ytdlbtn")) {
            indiv.appendChild(inspan);
            dlbtn.appendChild(indiv);
            startat.insertAdjacentElement("afterend", dlbtn);
        }
    }
}
async function triggerDL(ytlink: string) {
    const m = getPlayerMeta();
    startloader("info", "Download Initiated!");
    chrome.runtime.sendMessage({ ytlink: ytlink, md: m });
}
function startloader(type: string, msg: string) {
    const loaderdiv = document.createElement("div");
    loaderdiv.id = "ytmdl-load-div";
    loaderdiv.setAttribute("data-component", "dismissible-item");
    loaderdiv.setAttribute("data-type", type);
    loaderdiv.setAttribute("data-value", msg);
    const layout = document.getElementById("layout");
    if (layout) {
        layout.insertBefore(loaderdiv, layout.firstChild);
        dismissiblefunc();
        setTimeout(stoploader, 3000);
    }

}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.complete) {
        startloader("success", "Download Completed Successfully!")
    }
});
function stoploader() {
    const ld = document.getElementById("ytmdl-load-div");
    if (ld) {
        document.getElementById("layout")?.removeChild(ld);
    }
}

interface DismissibleElement extends HTMLElement {
    remove(): void;
}
function dismissiblefunc() {
    const dismissibleItem = (el: DismissibleElement, type: string, value: string) => {
        const html = `<span>${value} <button type="button" class="close">X</button></span>`;

        el.removeAttribute('data-component');
        el.removeAttribute('data-value');
        el.removeAttribute('data-type');

        el.classList.add('dismissible', `dismissible-${type}`);

        el.innerHTML = html;

        el.querySelector('.close')?.addEventListener('click', (event) => {
            let height = el.offsetHeight,
                opacity = 1,
                timeout: number | null = null;

            const reduceHeight = () => {
                height -= 2;
                el.setAttribute('style', `height: ${height}px; opacity: ${opacity}`);
                if (height <= 0) {
                    window.clearInterval(timeout!);
                    timeout = null;
                    el.remove();
                }
            };

            const fade = () => {
                opacity -= 0.1;
                el.setAttribute('style', `opacity: ${opacity}`);
                if (opacity <= 0) {
                    window.clearInterval(timeout!);
                    timeout = window.setInterval(reduceHeight, 1);
                }
            };

            timeout = window.setInterval(fade, 25);
        });
    };

    const dismissibles = Array.from(document.querySelectorAll<HTMLElement>('[data-component="dismissible-item"]'));
    if (dismissibles.length) {
        for (let i = 0; i < dismissibles.length; i++) {
            const type = dismissibles[i].getAttribute('data-type'),
                value = dismissibles[i].getAttribute('data-value');
            if (type && value) {
                dismissibleItem(dismissibles[i] as DismissibleElement, type, value);
            }
        }
    }
}
function getPlayerMeta(): MetaResult {
    var m: MetaResult = { title: "", artist: "", album: "", albumart: "" };
    const element1 = document.querySelector('yt-formatted-string.title.style-scope.ytmusic-player-bar');
    if (element1) {
        const text = element1.textContent;
        if (text) {
            m.title = text;
        }
    }

    const element = document.querySelector('yt-formatted-string.byline.style-scope.ytmusic-player-bar');
    if (element) {
        const textContent = element.textContent;
        const aay = textContent?.split(" • ")
        if (aay) {
            if (aay.length >= 1) {
                m.artist = aay[0];
            }
            if (aay.length >= 2) {
                m.album = aay[1];
            }
        }
    }

    const imageElement = document.getElementById('img');
    if (imageElement && imageElement.hasAttribute('src')) {
        const srcValue = imageElement.getAttribute('src');
        if (srcValue) {
            m.albumart = srcValue;
        }
    }
    return m;
}