// client.ts
// (C) Martin Alebachew, 2023

import { logger } from "../index";
import { MongoClient, ObjectId } from "mongodb";
import type { WithId, Document } from "mongodb";
import { rmSync, writeFileSync, mkdirSync, readdirSync, statSync, readFileSync } from "fs";

const DATABASE = "persistent-disk";

interface IWrappedData extends WithId<Document> {
    _id: ObjectId,
    filename: string,
    contentBase64: string
}

class WrappedData implements IWrappedData {
    public _id: ObjectId;
    public filename: string;
    public contentBase64: string;

    constructor(filename: string, contentBase64: string) {
        this._id = new ObjectId();
        this.filename = filename;
        this.contentBase64 = contentBase64;
    }
}

export class Client {
    private connection: MongoClient;

    constructor(username: string, password: string, endpoint: string) {
        const uri = `mongodb+srv://${username}:${password}@${endpoint}/?retryWrites=true&w=majority`;
        this.connection = new MongoClient(uri);
    }

    public async closeConnection() {
        await this.connection.close();
    }

    public async uploadDirectory(folder: string) {
        logger.info("\nUploading authentication files...");

        const database = this.connection.db(DATABASE);
        const collection = database.collection(folder);
        await collection.drop().catch(_ => _);  // Clear all previous data

        const wrappedList = await this.fetchDirectory(folder);
        await collection.insertMany(wrappedList);

        logger.info("Successfully uploaded authentication files.\n");
    }

    private async fetchDirectory(folder: string) {
        let wrappedList: WrappedData[] = [];
        const files = readdirSync("./" + folder);
        for (const filename of files) {
            const relativePath = folder + "/" + filename;
            if (!statSync(relativePath).isDirectory()) wrappedList.push(await this.fetchFile(relativePath));
            else wrappedList = wrappedList.concat(await this.fetchDirectory(relativePath));
        }

        if (files.length === 0) {  // Empty directory
            const relativePath = folder + "/" + "@";
            wrappedList.push(await this.fetchFile(relativePath, true));
        }

        return wrappedList;
    }

    public async fetchFile(relativePath: string, empty = false) {
        const data = empty ? "" : readFileSync(relativePath, { encoding: "base64" });  // Read file contents and encode as base64
        const relativePathNoFolder = relativePath.split("/").slice(1).join("/");
        const wrapped = new WrappedData(relativePathNoFolder, data);
        logger.trace("* Fetched: ", relativePath);
        return wrapped;
    }

    public downloadFile(folder: string, wrapped: WrappedData) {
        const relativePathNoFolder = wrapped.filename;
        const relativePath = folder + "/" + relativePathNoFolder;
        const data = wrapped.contentBase64;

        if (!relativePath.endsWith("@")) {
            const relativePathNoFile = relativePath.split("/").slice(0, -1).join("/");
            mkdirSync(relativePathNoFile, { recursive: true });
            writeFileSync(relativePath, data, { encoding: "base64" });  // Write file contents decoded as base64
        } else mkdirSync(relativePath, { recursive: true });

        logger.trace("* Downloaded: ", relativePath);
    }

    public async downloadDirectory(folder: string) {
        logger.info("\nDownloading authentication files...");
        rmSync(folder, { recursive: true, force: true });

        const database = this.connection.db(DATABASE);
        const collection = database.collection(folder);
        const documents = await collection.find({ });
        await documents.forEach((document) => {
            this.downloadFile(folder, document as WrappedData);
        });

        logger.info("Successfully downloaded authentication files.\n");
    }
}
