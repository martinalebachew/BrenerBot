// main.ts
// (C) Martin Alebachew, 2023

import { join } from "path"
import { Command, GroupChatPermissions, PrivateChatPermissions } from "./commands/commands"
import { log } from "./log"
import { GroupChat, Message } from 'whatsapp-web.js'

const { Client, LocalAuth, MessageTypes } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')


// Hard coded preferences
const BOT_PREFIX = "!"  // Prefix for all bot commands
const OWNER_CHAT_ID = "<country-code><number>@c.us"  // Bot's owner phone number


// Phase 1: Load commands
// Load command files and extract commands
log("Loading command files...")

let commandsDict: { [key: string]: Command } = { }
;(function scanForCommandFiles(fullDir: string) {
    let filesystem = require("fs")
    filesystem.readdirSync(fullDir).forEach((filename: string) => {
        // For every file and directory under the commands directory:
        if (!filename.endsWith("commands.js")) {  // "commands" defines the 'Command' type
            let file = fullDir + '/' + filename  // Get full path
            if (filesystem.statSync(file).isDirectory())
                scanForCommandFiles(file)
            else {
                let command = require(file)
                log("* Loaded " + file)
                commandsDict[command.nativeText.name] = command
            }
        }
    });
})(join(__dirname, "commands"))  // Project's sub-directory for command files


// Phase 2: Connect to WhatsApp
const WhatsAppClient = new Client({
    authStrategy: new LocalAuth(),  // Try to restore last session
    puppeteer: { handleSIGINT: false }  // Required for auth persistence
})

WhatsAppClient.on('qr', (qr: string) => {
    qrcode.generate(qr, { small: true });
});

WhatsAppClient.on('ready', () => {
    log('Connected to WhatsApp.');
});

WhatsAppClient.on('message', async (msg: Message) => {
    // Processing Stage 1: Check message type
    if (msg.type !== MessageTypes.TEXT) return

    // Processing Stage 2: Obtain command
    let content = msg.body
    if (!content.startsWith(BOT_PREFIX)) return

    let command = commandsDict[content.substring(BOT_PREFIX.length)]
    if (!command) return

    // Processing Stage 3: Verify permissions
    if (msg.from.endsWith("@c.us")) {  // Private chat
        let senderPerms = (msg.from === OWNER_CHAT_ID) ? PrivateChatPermissions.Owner : PrivateChatPermissions.Everyone
        if (command.permissions.privateChat < senderPerms) return
    } else if (msg.from.endsWith("@g.us")) {  // Group chat
        let senderPerms
        if (msg.author === OWNER_CHAT_ID) senderPerms = GroupChatPermissions.Owner
        else {
            let isAdmin = false
            ;(await msg.getChat() as GroupChat).participants.every((participant) => {
                if (participant.id._serialized === msg.author) {
                    isAdmin = participant.isAdmin
                } else return true  // Continue iterating through participants
            })

            senderPerms = isAdmin ? GroupChatPermissions.Admin : GroupChatPermissions.Everyone
        }

        if (command.permissions.groupChat < senderPerms) return
    } else return

    // Processing Stage 4: Execute command
    await command.execute(WhatsAppClient, msg)
})

export async function cleanShutdown() {  // Required for auth persistence
    console.log('Terminating...');
    await WhatsAppClient.destroy();
    console.log('Closed WhatsApp connection.');
    process.exit(0);
}

process.on('SIGINT', cleanShutdown);   // CTRL+C
process.on('SIGQUIT', cleanShutdown);  // Keyboard quit
process.on('SIGTERM', cleanShutdown);  // `kill` command

WhatsAppClient.initialize();
