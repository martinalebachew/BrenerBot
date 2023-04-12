// index.ts
// (C) Martin Alebachew, 2023

import { join, basename } from "path";
import { Command, GroupChatPermissions, PrivateChatPermissions } from "./commands/commands";
import { dirToCategories } from "./commands/categories";
import { log } from "./utils/log";
import { WhatsAppConnection } from "./whatsapp-api/client";
import { TextMessage, MessageBase } from "./whatsapp-api/message";
import { UserAddress } from "./whatsapp-api/address";
import { parsePhoneNumber } from "libphonenumber-js";
import { Client } from "./mongodb-api/client";
import { existsSync, readdirSync, statSync } from "fs";
import { createServer } from "http";
import { MessageTypes } from "whatsapp-web.js";
import { pino } from "pino";


// Create global pino logger
export const logger = pino({
    level: "debug"
});

const LOG_HEADER = "---> ";
const LOG_SPACER = "     ";

// Heroku requirement: Dispatch HTTP listener
const server = createServer(function (req, res) {
    res.writeHead(200);  // OK response code
    res.end();
}).listen(process.env.PORT);

// Graceful termination state booleans
let processNewCommands = true;
let authDownloadCompleted = false;


// Phase 0: Load configuration
logger.info(LOG_HEADER + "Loading configuration...");
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
logger.info(LOG_SPACER + "Loaded Configuration.");

// Phase 1: Load commands
// Load command files and extract commands
logger.info(LOG_HEADER + "Loading command files...");

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
            logger.debug(LOG_SPACER + "* Loaded " + file);
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
logger.info(LOG_SPACER + "Loaded commands.");

// Phase 2: Connect to WhatsApp
const mongodb = new Client(username, password, endpoint);
const whatsapp = new WhatsAppConnection();

async function messageCallback(message: MessageBase) {
    /* Pre-processing: This function is called only on messages
    of a supported type and have been sent while the bot is online. */
    if (!(message instanceof TextMessage)) return;

    const messageLogger = logger.child({ message: message });
    messageLogger.trace(LOG_HEADER + "Analysing message...");

    if (!processNewCommands) {
        messageLogger.trace(LOG_SPACER + "Not to process new commands. Aborting.");
    } else messageLogger.trace(LOG_SPACER + "Allowed to process new commands. Continuing...");

    // Processing Stage 1: Obtain command
    const content = message.text;
    if (!content.startsWith(BOT_PREFIX)) {
        messageLogger.trace(LOG_SPACER + `Message doesn't start with configured bot prefix: "${config.botPrefix}". Aborting.`);
        return;
    } else messageLogger.trace(LOG_SPACER + `Message starts with configured bot prefix: "${config.botPrefix}". Continuing...`);

    const args = content.substring(BOT_PREFIX.length).split(" ");
    const commandKey = args.shift();
    if (!commandKey) {
        messageLogger.trace(LOG_SPACER + "Message doesn't contain a command key directly following the prefix. Aborting.");
        return;
    } else messageLogger.trace(LOG_SPACER + `Message contains a command key directly following the prefix: "${commandKey}". Continuing...`);

    const commandObj = commandsDict[commandKey];
    if (!commandObj) {
        messageLogger.trace(LOG_SPACER + "Failed to find a command matching the key specified above. Aborting.");
        return;
    } messageLogger.trace(LOG_SPACER + "Found a command matching the key specified above. Continuing...");

    // Processing Stage 2: Check message type
    const type = MessageTypes.TEXT;  // TODO: FIX TEMP WORKAROUND
    if (!commandObj.requestTypes.includes(type)) {
        messageLogger.trace(LOG_SPACER + `Message type "${type}" is not one of the command's supported types: ${commandObj.requestTypes}. Aborting.`);
        return;
    } messageLogger.trace(LOG_SPACER + `Message type "${type}" is one of the command's supported types: ${commandObj.requestTypes}. Continuing...`);

    // Processing Stage 3: Verify permissions
    if (!message.inGroup) {  // Private chat
        const senderPerms = (message.author.equals(OWNER_ADDRESS)) ? PrivateChatPermissions.Owner : PrivateChatPermissions.Everyone;
        messageLogger.trace(LOG_SPACER + `Analyzed author permissions as Private Chat @ ${PrivateChatPermissions[senderPerms]}.`);

        const commandPerms = commandObj.permissions.privateChat;
        if (commandPerms < senderPerms) {
            messageLogger.trace(LOG_SPACER + `Author permissions are insufficient, this command requires Private Chat @ ${PrivateChatPermissions[commandPerms]}. Aborting.`);
            return;
        } messageLogger.trace(LOG_SPACER + `Author permissions are sufficient, this command requires Private Chat @ ${PrivateChatPermissions[commandPerms]}. Continuing...`);

    } else {  // Group chat
        let senderPerms;
        if (message.author.equals(OWNER_ADDRESS)) senderPerms = GroupChatPermissions.Owner;
        else senderPerms = GroupChatPermissions.Everyone;
        // else {
        //     const groupMetadata = await whatsapp.fetchGroupMetadata(message.chat);
        //     const participant = groupMetadata.participants.find((participant: GroupParticipant) => {
        //         return participant.id === message.author.serialized;
        //     });
        //
        //     const isAdmin = participant.isAdmin || participant.isSuperAdmin;
        //     senderPerms = isAdmin ? GroupChatPermissions.Admin : GroupChatPermissions.Everyone;
        // }

        messageLogger.trace(LOG_SPACER + `Analyzed author permissions as Group Chat @ ${GroupChatPermissions[senderPerms]}.`);

        const commandPerms = commandObj.permissions.groupChat;
        if (commandPerms < senderPerms) {
            messageLogger.trace(LOG_SPACER + `Author permissions are insufficient, this command requires Group Chat @ ${GroupChatPermissions[commandPerms]}. Aborting.`);
            return;
        } messageLogger.trace(LOG_SPACER + `Author permissions are sufficient, this command requires Group Chat @ ${GroupChatPermissions[commandPerms]}. Continuing...`);
    }

    // Processing Stage 4: Execute command
    messageLogger.info(LOG_HEADER + `Executing command ${commandKey}...`);
    await commandObj.execute(whatsapp, message, type, args);
    messageLogger.trace(LOG_SPACER + "Completed execution.");
}

export async function terminateGracefully(signal: string) {  // Required for auth persistence
    console.log(`\n[${signal}] Terminating...`);
    processNewCommands = false;

    // Allow 5 seconds for processing current commands
    setTimeout(async () => {
        await whatsapp.destroy().catch(_ => _);  // Close WhatsApp connection to flush auth files
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
    whatsapp.serve(messageCallback).catch(_ => _);  // Catch is a temporary workaround, errors might be thrown after calling destroy().
});
