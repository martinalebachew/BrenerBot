// index.ts
// (C) Martin Alebachew, 2023

import { join, basename } from "path";
import { Command, GroupChatPermissions, PrivateChatPermissions } from "./commands/commands";
import { dirToCategories } from "./commands/categories";
import { log } from "./utils/log";
import { WhatsAppConnection } from "./whatsapp-api/client";
import { TextMessage } from "./whatsapp-api/message";
import { UserAddress } from "./whatsapp-api/address";
import { parsePhoneNumber } from "libphonenumber-js";
import { Client } from "./mongodb-api/client";
import { existsSync, readdirSync, statSync } from "fs";
import { createServer } from "http";
import { MessageTypes } from "whatsapp-web.js";

// Heroku requirement: Dispatch HTTP listener
const server = createServer(function (req, res) {
    res.writeHead(200);  // OK response code
    res.end();
}).listen(process.env.PORT);

// Graceful termination state booleans
let processNewCommands = true;
let authDownloadCompleted = false;


// Phase 0: Load configuration
export let config: any;
if (existsSync(join(__dirname,"../config.json"))) {
    log("Loading configuration from config.json...");
    config  = require("../config.json");
} else log("Loading configuration from environment variables...");

const BOT_PREFIX = config?.botPrefix || process.env.BOT_PREFIX;  // Prefix for all bot commands
const phoneNumber = parsePhoneNumber(config?.phoneNumber || process.env.PHONE_NUMBER, config?.countryCode || process.env.COUNTRY_CODE);
const OWNER_ADDRESS = new UserAddress(phoneNumber.countryCallingCode + phoneNumber.nationalNumber);  // Bot owner's address
const username = config?.mongoDB?.username || process.env.MONGODB_USERNAME;
const password = config?.mongoDB?.password || process.env.MONGODB_PASSWORD;
const endpoint = config?.mongoDB?.endpoint || process.env.MONGODB_ENDPOINT;


// Phase 1: Load commands
// Load command files and extract commands
log("Loading command files...");

export const commandsDict: { [key: string]: Command } = { };
export const commandsByCategories: { [key: string]: Command[] } = { };
function scanForCommandFiles(fullDir: string) {
    readdirSync(fullDir).forEach((filename) => {
    // for (const filename in readdirSync(fullDir)) {
        // For every file and directory under the commands directory:
        if (filename.endsWith("commands.js") || filename.endsWith("categories.js")) return;  // Both files are NOT commands
        const file = fullDir + "/" + filename;  // Get full path
        if (statSync(file).isDirectory()) {
            scanForCommandFiles(file);
            // TODO: limit to one level only
        } else {
            const command = require(file);
            log("* Loaded " + file);
            commandsDict[command.nativeText.name] = command;

            const category = dirToCategories[basename(fullDir)];
            if (!category) throw Error(`No matching category for directory: ${basename(fullDir)}`);
            if (!commandsByCategories[category])
                commandsByCategories[category] = [];
            commandsByCategories[category].push(command);
        }
    });
}

scanForCommandFiles(join(__dirname, "commands")); // Project's sub-directory for command files
log("Loaded commands.");

// Phase 2: Connect to WhatsApp
const mongodb = new Client(username, password, endpoint);
const whatsapp = new WhatsAppConnection();

async function messageCallback(message: TextMessage) {
    /* Pre-processing: This function is called only on messages
    of a supported type and have been sent while the bot is online. */

    if (!processNewCommands) return;

    // Processing Stage 1: Obtain command
    const content = message.text;
    if (!content.startsWith(BOT_PREFIX)) return;

    const args = content.substring(BOT_PREFIX.length).split(" ");
    const commandKey = args.shift();
    if (!commandKey) return;

    const commandObj = commandsDict[commandKey];
    if (!commandObj) return;

    // Processing Stage 2: Check message type
    const type = MessageTypes.TEXT;  // TODO: FIX TEMP WORKAROUND
    if (!commandObj.requestTypes.includes(type)) return;

    // Processing Stage 3: Verify permissions
    if (!message.inGroup) {  // Private chat
        const senderPerms = (message.author.equals(OWNER_ADDRESS)) ? PrivateChatPermissions.Owner : PrivateChatPermissions.Everyone;
        if (commandObj.permissions.privateChat < senderPerms) return;
    } else {  // Group chat
        let senderPerms;
        if (message.author.equals(OWNER_ADDRESS)) senderPerms = GroupChatPermissions.Owner;
        else senderPerms = GroupChatPermissions.Everyone;
        // else {
        //     let groupMetadata = await whatsapp.fetchGroupMetadata(message.chat)
        //     let participant = groupMetadata.participants.find((participant: GroupParticipant) => {
        //         return participant.id === message.author.serialized
        //     })
        //
        //     let isAdmin = participant.isAdmin || participant.isSuperAdmin
        //     senderPerms = isAdmin ? GroupChatPermissions.Admin : GroupChatPermissions.Everyone
        // }

        if (commandObj.permissions.groupChat < senderPerms) return;
    }

    // Processing Stage 4: Execute command
    log("---> Executing command", commandObj.nativeText.name, "from", message.author.serialized);
    await commandObj.execute(whatsapp, message, type, args);
}

export async function terminateGracefully(signal: string) {  // Required for auth persistence
    console.log(`[${signal}] Terminating...`);
    processNewCommands = false;

    // Allow 5 seconds for processing current commands
    setInterval(async () => {
        await whatsapp.destroy();  // Close WhatsApp connection to flush auth files
        if (authDownloadCompleted) await mongodb.uploadDirectory("wwebjs_auth");  // Upload auth files
        await mongodb.closeConnection();
        server.close();
        console.log("Finished.");
        process.exit(0);
    }, 5000);

}

process.on("SIGINT", () => terminateGracefully("SIGINT"));   // CTRL+C
process.on("SIGTERM", () => terminateGracefully("SIGTERM"));  // `kill` command

mongodb.downloadDirectory("wwebjs_auth").then(() => {  // Restore session
    authDownloadCompleted = true;
    whatsapp.serve(messageCallback);
});
