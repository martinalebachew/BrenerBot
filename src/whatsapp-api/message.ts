// message.ts
// (C) Martin Alebachew, 2023

import { Message, MessageTypes } from "whatsapp-web.js";
import { Address, GroupAddress, UserAddress } from "./address";

export class MessageBase {
    public author: UserAddress;
    public chat: UserAddress | GroupAddress;
    public inGroup: boolean;
    public raw: Message;

    constructor(rawMessage: Message, author: UserAddress, chat: UserAddress | GroupAddress, inGroup: boolean) {
        this.author = author;
        this.chat = chat;
        this.inGroup = inGroup;
        this.raw = rawMessage;
    }

    public static parse(message: Message): MessageBase | undefined {
        const chat = Address.parse(message.from || message.to);
        if (!chat) return;

        const inGroup = !(chat instanceof UserAddress);
        let author;

        if (inGroup) {
            author = Address.parse(message.author ?? "");
            if (!author) return;
        } else author = chat;

        if (message.type === MessageTypes.TEXT)  // Text message
            return new TextMessage(message, author, chat, message.body, inGroup);
        else  // Unsupported message type
            return;
    }
}

export class TextMessage extends MessageBase {
    public text: string;

    constructor(rawMessage: Message, author: UserAddress, chat: UserAddress | GroupAddress, text: string, inGroup: boolean) {
        super(rawMessage, author, chat, inGroup);
        this.text = text;
    }
}

// export interface ImageMessage extends MessageBase {
//     text: string
//     image:
// }
