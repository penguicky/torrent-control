import {
    ServerOptions, TorrentOptions,
} from '../util';

export default class BaseClient {
    settings: ServerOptions;
    listeners: {
        onHeadersReceived?: (details: chrome.webRequest.WebResponseHeadersDetails) => void;
        onBeforeSendHeaders?: (details: chrome.webRequest.WebResponseHeadersDetails) => void | chrome.webRequest.BlockingResponse;
        onAuthRequired?: (details: chrome.webRequest.WebAuthenticationChallengeDetails) => void;
        onAuthCompleted?: (details: chrome.webRequest.WebResponseCacheDetails) => void;
    };
    pendingRequests: Array<number | string>;

    constructor() {
        this.listeners = {};
        this.pendingRequests = [];
    }

    logIn(): Promise<void> {
        return Promise.resolve();
    }

    logOut(): Promise<void> {
        return Promise.resolve();
    }

    addTorrent(torrent: File, options: TorrentOptions): Promise<void> {
        return Promise.resolve();
    }

    addTorrentUrl(url: string, options: TorrentOptions): Promise<void> {
        return Promise.resolve();
    }

    addRssFeed(url: string): Promise<void> {
        return Promise.resolve();
    }

    addHeadersReceivedEventListener(listener) {
        const {hostname} = this.settings;

        this.listeners.onHeadersReceived = listener;

        chrome.webRequest.onHeadersReceived.addListener(
            this.listeners.onHeadersReceived,
            {urls: [hostname.replace(/:\d+/, '') + '*']},
            ['blocking', 'responseHeaders']
        );
    }

    addBeforeSendHeadersEventListener(listener) {
        const {hostname} = this.settings;

        this.listeners.onBeforeSendHeaders = listener;

        chrome.webRequest.onBeforeSendHeaders.addListener(
            this.listeners.onBeforeSendHeaders,
            {urls: [hostname.replace(/:\d+/, '') + '*']},
            ['blocking', 'requestHeaders']
        );
    }

    addAuthRequiredListener(username: string, password: string) {
        const {hostname} = this.settings;

        this.listeners.onAuthRequired = (details) => {
            if (this.pendingRequests.indexOf(details.requestId) !== -1)
                return;

            this.pendingRequests.push(details.requestId);

            return {
                authCredentials: {
                    username: username,
                    password: password
                }
            };
        };

        this.listeners.onAuthCompleted = (details) => {
            let index = this.pendingRequests.indexOf(details.requestId);

            if (index > -1)
                this.pendingRequests.splice(index, 1);
        };

        chrome.webRequest.onAuthRequired.addListener(
            this.listeners.onAuthRequired,
            {urls: [hostname.replace(/:\d+/, '') + '*']},
            ['blocking']
        );

        chrome.webRequest.onCompleted.addListener(
            this.listeners.onAuthCompleted,
            {urls: [hostname.replace(/:\d+/, '') + '*']},
        );

        chrome.webRequest.onErrorOccurred.addListener(
            this.listeners.onAuthCompleted,
            {urls: [hostname.replace(/:\d+/, '') + '*']},
        );
    }

    removeEventListeners() {
        if (this.listeners.onHeadersReceived)
            chrome.webRequest.onHeadersReceived.removeListener(this.listeners.onHeadersReceived);

        if (this.listeners.onBeforeSendHeaders)
            chrome.webRequest.onBeforeSendHeaders.removeListener(this.listeners.onBeforeSendHeaders);

        if (this.listeners.onAuthRequired) {
            chrome.webRequest.onAuthRequired.removeListener(this.listeners.onAuthRequired);
            chrome.webRequest.onCompleted.removeListener(this.listeners.onAuthCompleted);
            chrome.webRequest.onErrorOccurred.removeListener(this.listeners.onAuthCompleted);
        }
    }

    parseJsonResponse(response: Response) {
        const contentType = response.headers.get('content-type');
        const isJson = !!contentType.match(/application\/json/)

        if (response.ok && isJson)
            return response.json();
        else if (response.ok && !isJson)
            return response.text().then((text) => {
                throw new Error(chrome.i18n.getMessage('apiError', text.trim().slice(0, 256)));
            });
        else if (response.status === 400)
            throw new Error(chrome.i18n.getMessage('torrentAddError'));
        else if (response.status === 401)
            throw new Error(chrome.i18n.getMessage('loginError'));
        else
            throw new Error(chrome.i18n.getMessage('apiError', response.status.toString() + ': ' + response.statusText));
    }

    filterHeaders(headers, filters: string[]) {
        return headers.filter((header) => {
            return !filters.includes(header.name.toLowerCase());
        });
    }

    getCookie(headers, key: string): null | string {
        const cookie = headers.find((header) => {
            return header.name.toLowerCase() === 'set-cookie';
        });

        const regex = new RegExp(key + '=(.+?);');

        if (cookie)
            return cookie.value.match(regex)[0] || null;

        return null;
    }
}