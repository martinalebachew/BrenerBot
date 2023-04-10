// index.ts
// (C) Martin Alebachew, 2023

import { join, basename } from "path";
import { Command, GroupChatPermissions, PrivateChatPermissions } from "./commands/commands";
import { dirToCategories } from "./commands/categories";
import { log } from "./utils/log";
import { WhatsAppConnection } from "./whatsapp-api/client";
import { TextMessage } from "./whatsapp-api/message";
import { UserAddress} from "./whatsapp-api/address";
import { CountryCode, parsePhoneNumber} from "libphonenumber-js";
import { GroupParticipant } from "@adiwajshing/baileys";
import { readdirSync, statSync } from "fs";
import { pino } from "pino";

// Create global pino logger
export const logger = pino({
    level: "debug"
});

const LOG_HEADER = "---> ";
const LOG_SPACER = "     ";


// Phase 0: Load configuration file
logger.info(LOG_HEADER + "Loading configuration...");
import config from "./config.json";
const BOT_PREFIX = config.botPrefix;  // Prefix for all bot commands

const phoneNumber = parsePhoneNumber(config.phoneNumber, config.countryCode as CountryCode);
const OWNER_ADDRESS = new UserAddress(parseInt(phoneNumber.countryCallingCode + phoneNumber.nationalNumber));  // Bot owner's address
logger.info(LOG_SPACER + "Loaded Configuration.");

// Phase 1: Load commands
// Load command files and extract commands
logger.info(LOG_HEADER + "Loading command files...");

export const commandsDict: { [key: string]: Command } = { };
export const commandsByCategories: { [key: string]: Command[] } = { }
;(function scanForCommandFiles(fullDir: string) {
    readdirSync(fullDir).forEach((filename: string) => {
        // For every file and directory under the commands directory:
        if (!filename.endsWith("commands.js") && !filename.endsWith("categories.js")) {  // Both files are NOT commands
            const file = fullDir + "/" + filename;  // Get full path
            if (statSync(file).isDirectory())
                scanForCommandFiles(file);
                // TODO: limit to one level only
            else {
                const command = require(file);
                logger.debug(LOG_SPACER + "* Loaded " + file);
                commandsDict[command.nativeText.name] = command;

                const category = dirToCategories[basename(fullDir)];
                if (!category) throw Error(`No matching category for directory: ${basename(fullDir)}`);
                if (!commandsByCategories[category])
                    commandsByCategories[category] = [];
                commandsByCategories[category].push(command);
            }
        }
    });
})(join(__dirname, "commands"));  // Project's sub-directory for command files
logger.info(LOG_SPACER + "Loaded commands.");

// Phase 2: Connect to WhatsApp
const whatsapp = new WhatsAppConnection();
whatsapp.authenticate().then(async () => { await whatsapp.setCallback(messageCallback); });

async function messageCallback(message: TextMessage, type: string) {
    /* Pre-processing: This function is called only on messages
    of a supported type and have been sent while the bot is online. */

    const messageLogger = logger.child({ message: message });

    messageLogger.trace(LOG_HEADER + "Analysing message...");

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
        else {
            const groupMetadata = await whatsapp.fetchGroupMetadata(message.chat);
            const participant = groupMetadata.participants.find((participant: GroupParticipant) => {
                return participant.id === message.author.serialized;
            });

            const isAdmin = participant.isAdmin || participant.isSuperAdmin;
            senderPerms = isAdmin ? GroupChatPermissions.Admin : GroupChatPermissions.Everyone;
        }

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
