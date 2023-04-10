// client.ts
// (C) Martin Alebachew, 2023

import { MongoClient, Db, Collection, ObjectId } from "mongodb";
import type { WithId, Document } from "mongodb";
import { rmSync, writeFileSync, mkdirSync, readdirSync, statSync, readFileSync } from "fs";

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
        console.log("\nUploading authentication files...");

        const database = this.connection.db("persistent-storage");
        const collection = database.collection(folder);
        const wrappedArray = await this.fetchDirectory(folder);
        await collection.insertOne({ wrappedArray });

        console.log("Successfully uploaded authentication files.\n");
    }

    private async fetchDirectory(folder: string) {
        const wrappedArray: WrappedData[] = [];
        const files = readdirSync("./" + folder);
        for (const filename of files) {
            const relativePath = folder + "/" + filename;
            if (!statSync(relativePath).isDirectory()) wrappedArray.push(await this.fetchFile(relativePath));
            else wrappedArray.concat(await this.fetchDirectory(relativePath));
        }

        if (files.length === 0) {  // Empty directory
            const relativePath = folder + "/" + "@";
            wrappedArray.push(await this.fetchFile(relativePath, true));
        }

        return wrappedArray;
    }

    public async fetchFile(relativePath: string, empty = false) {
        const data = empty ? "" : readFileSync(relativePath, { encoding: "base64" });  // Read file contents and encode as base64
        const relativePathNoFolder = relativePath.split("/").slice(1).join("/");
        const wrapped = new WrappedData(relativePathNoFolder, data);
        console.log("* Fetched: ", relativePath);
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

        console.log("* Downloaded: ", relativePath);
    }

    public async downloadDirectory(folder: string) {
        console.log("\nDownloading authentication files...");
        rmSync(folder, { recursive: true, force: true });

        const database = this.connection.db("persistent-storage");
        const collection = database.collection(folder);
        const documents = await collection.find({ });
        await documents.forEach((document) => {
            this.downloadFile(folder, document as WrappedData);
        });

        console.log("Successfully downloaded authentication files.\n");
    }
}
