// help.ts
// (C) Martin Alebachew, 2023

import { MessageTypes } from "whatsapp-web.js";
import { Command, GroupChatPermissions, PrivateChatPermissions } from "../commands";
import { commandsDict } from "../../index";
import { WhatsAppConnection } from "../../whatsapp-api/client";
import { MessageBase } from "../../whatsapp-api/message";

const NATIVE_HELP_HEADER = "*היי, אני ברנרבוט 👋*\nהנה הפקודות שלי:\n\n";

const command: Command = {
    requestTypes: [MessageTypes.TEXT],

    permissions: {
        groupChat: GroupChatPermissions.Everyone,
        privateChat: PrivateChatPermissions.Everyone
    },

    nativeText: {
        name: "עזרה",
        description: ""
    },

    async execute(whatsapp: WhatsAppConnection, message: MessageBase, type: string, args: string[]) {
        if (args.length) return;
        let helpMsg = NATIVE_HELP_HEADER;
        for (const commandName in commandsDict) {
            helpMsg += "* !" + commandName + "\n";
        }

        await message.raw.reply(helpMsg);
    }
};

module.exports = command;
