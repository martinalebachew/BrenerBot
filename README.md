# BrenerBot 🤖

An easy-to-use WhatsApp utility bot, written in TypeScript.
Designed mainly for group chats!

> **Warning**
> BrenerBot relies on Baileys to connect to the WhatsApp API. The connection _should_ be
> stable and not trigger any bans. However, WhatsApp hates fun, so consider it as a possibility,
> don't do anything stupid and pay attention to the API limits.

## Functionality

### Commands

| Command                                               | Description                 | Availability |
| :---------------------------------------------------- | :-------------------------- | :----------- |
| [stickers/create.ts](src/commands/stickers/create.ts) | Create stickers from text   | ✅           |
| [stickers/create.ts](src/commands/stickers/create.ts) | Create stickers from images | ❌           |
| [stickers/create.ts](src/commands/stickers/create.ts) | Create stickers from videos | ❌           |
| [stickers/create.ts](src/commands/stickers/create.ts) | Create stickers from GIFs   | ❌           |
| [admin/shutdown.ts](src/commands/admin/shutdown.ts)   | Remote termination by owner | ✅           |
| [other/code.ts](src/commands/other/code.ts)           | View source code            | ✅           |
| [other/help.ts](src/commands/other/help.ts)           | View all commands           | 🚧           |

### Features

| Feature              | Branch            | Availability |
| :------------------- | :---------------- | :----------- |
| Advanced logging     | feature/logging   | 🚧           |
| Heroku compatibility |                   | ✅           |

## Getting started

### Install Dependencies

BrenerBot requires the following software:

- NodeJS
- ffmpeg

After installing the requirements above and adding them to the PATH environment variable, you can use the following command to install all the required libraries:

```
npm install
```

### Configure BrenerBot

Create a config.json file from the config.json.example file:

_config.json_

```json
{
  "botPrefix": "!",
  "countryCode": "US",
  "phoneNumber": "2133734253",

  "mongoDB": {
    "username": "heroku",
    "password": "password1",
    "endpoint": "bot-data-cluster.49nJ3We.mongodb.net"
  }
}
```

BrenerBot will respond only to messages that start with the `botPrefix`, and exactly follow the command syntax.

`countryCode` and `phoneNumber` are used to specify the owner's phone number. This is a privileged user and has additional command-running permissions.

`countryCode` should contain the owner's country code as a two-letters string (ISO 3166-1 Alpha-2). [Click here](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2#Officially_assigned_code_elements) for a complete list.

`phoneNumber` should contain the owner's phone number, without any prefix. This includes a plus sign, a country code or any leading zeros.

All values under `mongoDB` are redundant in the _config.json_ file and are used mainly for development.
However, it is possible to use them and configure MongoDB. To learn more, read the following section:

### Target platform doesn't have persistent storage?

It is possible to configure BrenerBot for platforms that don't support persistent storage, by using environment variables and MongoDB.

1. Create a MongoDB account for free and a new cluster for BrenerBot's data. This cluster should be used by one BrenerBot instance only.
2. Set the following environment variables:
   - `BOT_PREFIX` - identical to `botPrefix` in _config.json_. See usage above.
   - `PHONE_NUMBER` - identical to `phoneNumber` in _config.json_. See usage above.
   - `COUNTRY_CODE` - identical to `countryCode` in _config.json_. See usage above.
   - `MONGODB_USERNAME` - identical to `mongoDB.username` in _config.json_. Set this value to the username of a MongoDB user
     with full read/write permissions to BrenerBot's data cluster you created.
   - `MONGODB_PASSWORD` - identical to `mongoDB.username` in _config.json_. Set this value to the user's password. Note that
     some special characters are not supported and may cause the connection to fail.
   - `MONGODB_ENDPOINT` - identical to `mongoDB.username` in _config.json_. Set this value to the cluster's url.
     You can extract this value from the example connection string . For example, in this connection string:
     `mongodb+srv://heroku:<password>@brenerbot.49nJ3We.mongodb.net/?retryWrites=true&w=majority`,
     the endpoint url is `brenerbot.49nJ3We.mongodb.net`, basically everything after `@` and before `/`.

### Compile & Run

This project contains three built-in scripts, written for unix and unix-like systems. On other operating systems, mainly windows, you will need to manually edit those scripts and replace OS-specific commands (currently only `rm -r build`).

#### Build: Compile TypeScript files into JavaScript

```
npm run build
```

#### Start: Run BrenerBot from compiled build

```
npm start
```

And that's it!

### Optional: Add Commands!

BrenerBot is build with a high level of modularity in mind. You can add your own commands by creating command files in a subdirectory under 'src/commands' and
conforming with the command structure, as specified in 'src/commands/commands.ts'. Make sure to include this subdirectory in 'src/commands/categories.ts' and define the corresponding category name in native language.

A command file should look like this:

```typescript
import {
  Command,
  GroupChatPermissions,
  PrivateChatPermissions,
} from "../commands";
import { Client, Message } from "whatsapp-web.js";

let command: Command = {
  permissions: {
    groupChat: GroupChatPermissions.Everyone,
    privateChat: PrivateChatPermissions.Owner,
  },

  nativeText: {
    name: "ping",
    description: "pongs!",
    category: "misc",
  },

  async execute(client: Client, msg: Message, args: string[]) {
    if (args.length) return;
    await msg.reply("pong! 🏓");
  },
};

module.exports = command;
```

Share your commands with us :)

### Running BrenerBot on Heroku

Add the following buildpacks in your app:

- https://github.com/heroku/heroku-buildpack-nodejs
- https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest
- https://elements.heroku.com/buildpacks/jontewks/puppeteer-heroku-buildpack

BrenerBot now supports GitHub deployment on Heroku!

1. Create a Heroku application.
2. Configure BrenerBot. See [Configuring BrenerBot without persistent storage](#target-platform-doesnt-have-persistent-storage).
3. Connect your Heroku application to BrenerBot's GitHub repository and enable automatic deployments of the `main` branch.
4. Check out the application's logs - a QR code should be printed. Scan this code using BrenerBot's WhatsApp account.
5. That's it! BrenerBot is up and running!
