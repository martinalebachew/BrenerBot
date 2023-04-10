// client.ts
// (C) Martin Alebachew, 2023

import { Client, Message } from "whatsapp-web.js";
import { MongoAuth } from "./mongo-auth";
import { MessageBase, TextMessage } from "./message";
import { Client as MongoClient } from "../mongodb-api/client";
import qrcode from "qrcode-terminal";

export class WhatsAppConnection {
    private client: Client;

    constructor() {
        this.client = new Client({
            authStrategy: new MongoAuth(),
            puppeteer: {
                args: ["--no-sandbox"]
            }
        });

        this.client.on("qr", (qr) => {
            qrcode.generate(qr, { small: true });
        });

        this.client.on("ready", () => {
            console.log("🟢 Connected!");
        });
    }

    async serve(mongoClient: MongoClient, messageCallback: (message: TextMessage) => Promise<void>) {
        // await mongoClient.downloadAll(".wweb_auth");
        // TODO: add creds hook here / auth strategy

        this.client.on("message", (message: Message) => {  // Handles only messages sent while BrenerBot is up
            const parsed = MessageBase.parse(message);
            if (parsed) messageCallback(parsed as TextMessage);
        });

        await this.client.initialize();
    }

    // async fetchGroupMetadata(address: GroupAddress) {
    //     const allGroupsMetadata = await this.client.groupFetchAllParticipating();
    //     return allGroupsMetadata[address.serialized];
    // }

    // async reply(message: MessageBase, text: string) {
    //     await this.client.sendMessage(message.chat.serialized, { text: text }, { quoted: message.raw });
    // }
}
