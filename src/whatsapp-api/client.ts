// client.ts
// (C) Martin Alebachew, 2023

import { Client, Message, LocalAuth } from "whatsapp-web.js";
import { MessageBase, TextMessage } from "./message";
import { Client as MongoClient } from "../mongodb-api/client";
import qrcode from "qrcode-terminal";

export class WhatsAppConnection {
    private client: Client;

    constructor() {
        this.client = new Client({
            authStrategy: new LocalAuth({
                dataPath: "wwebjs_auth"  // Omitted default dot to match MongoDB collection naming restrictions
            }),
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
        await mongoClient.downloadDirectory("wwebjs_auth");  // Restore session

        this.client.on("message", (message: Message) => {  // Handles only messages sent while BrenerBot is up
            const parsed = MessageBase.parse(message);
            if (parsed) messageCallback(parsed as TextMessage);
        });

        await this.client.initialize();
    }

    async destroy() {
        await this.client.destroy();
    }

    // async fetchGroupMetadata(address: GroupAddress) {
    //     const allGroupsMetadata = await this.client.groupFetchAllParticipating();
    //     return allGroupsMetadata[address.serialized];
    // }

    // async reply(message: MessageBase, text: string) {
    //     await this.client.sendMessage(message.chat.serialized, { text: text }, { quoted: message.raw });
    // }
}
