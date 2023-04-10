// mongo-auth.ts
// (C) Martin Alebachew, 2023
// This is a modified version of https://github.com/pedroslopez/whatsapp-web.js/blob/f88bd274be39bc19cf47cd18e8f9eaba291cde2c/src/authStrategies/LocalAuth.js and https://github.com/pedroslopez/whatsapp-web.js/blob/f88bd274be39bc19cf47cd18e8f9eaba291cde2c/src/authStrategies/BaseAuthStrategy.js

import { resolve, join } from "path";
import { mkdirSync, rmSync } from "fs";
import { Client } from "whatsapp-web.js";

class BaseAuthStrategy {
    client: any;
    constructor() { return; }
    setup(client: Client) {
        this.client = client;
    }
    async beforeBrowserInitialized() { return; }
    async afterBrowserInitialized() { return; }
    async onAuthenticationNeeded() {
        return {
            failed: false,
            restart: false,
            failureEventPayload: undefined
        };
    }
    async getAuthEventPayload() { return; }
    async logout() { return; }
    async afterAuthReady() { return; }
    async disconnect() { return; }
    async destroy() { return; }
}

export class MongoAuth extends BaseAuthStrategy {
    dataPath: string;
    userDataDir?: string;
    clientId?: string;
    constructor({ clientId, dataPath }: { clientId: string | undefined, dataPath: string | undefined } = { clientId: undefined, dataPath: undefined }) {
        super();

        const idRegex = /^[-_\w]+$/i;
        if(clientId && !idRegex.test(clientId)) {
            throw new Error("Invalid clientId. Only alphanumeric characters, underscores and hyphens are allowed.");
        }

        this.dataPath = resolve(dataPath || "./.wwebjs_auth/");
        this.clientId = clientId;
    }

    async beforeBrowserInitialized() {
        const puppeteerOpts = this.client.options.puppeteer;
        const sessionDirName = this.clientId ? `session-${this.clientId}` : "session";
        const dirPath = join(this.dataPath, sessionDirName);

        if(puppeteerOpts.userDataDir && puppeteerOpts.userDataDir !== dirPath) {
            throw new Error("LocalAuth is not compatible with a user-supplied userDataDir.");
        }

        mkdirSync(dirPath, { recursive: true });

        this.client.options.puppeteer = {
            ...puppeteerOpts,
            userDataDir: dirPath
        };

        this.userDataDir = dirPath;
    }

    async logout() {
        if (this.userDataDir) {
            return rmSync(this.userDataDir, { recursive: true, force: true });
        }
    }
}