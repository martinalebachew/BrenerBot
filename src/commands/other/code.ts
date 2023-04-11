// code.ts
// (C) Martin Alebachew, 2023

import { MessageTypes } from "whatsapp-web.js";
import { Command, GroupChatPermissions, PrivateChatPermissions } from "../commands";
import { WhatsAppConnection } from "../../whatsapp-api/client";
import { MessageBase } from "../../whatsapp-api/message";

const command: Command = {
    requestTypes: [MessageTypes.TEXT],

    permissions: {
        groupChat: GroupChatPermissions.Everyone,
        privateChat: PrivateChatPermissions.Everyone
    },

    nativeText: {
        name: "קוד",
        description: ""
    },

    async execute(whatsapp: WhatsAppConnection, message: MessageBase, type:string, args: string[]) {
        if (args.length) return;
        await message.raw.reply("https://github.com/martinalebachew/BrenerBot");
    }
};

module.exports = command;
