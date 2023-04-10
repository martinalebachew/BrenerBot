// client.ts
// (C) Martin Alebachew, 2023

import { MongoClient, Db, Collection, ObjectId } from "mongodb";
import type { WithId, Document } from "mongodb";
import { rmSync, writeFileSync, mkdirSync, readdirSync, statSync, readFileSync } from "fs";

const DATABASE = "whatsapp-auth";

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
    private database: Db;

    constructor(username: string, password: string, endpoint: string) {
        const uri = `mongodb+srv://${username}:${password}@${endpoint}/?retryWrites=true&w=majority`;
        this.connection = new MongoClient(uri);
        this.database = this.connection.db(DATABASE);
    }

    public async closeConnection() {
        await this.connection.close();
    }

    public async uploadDirectory(folder: string) {
        console.log("\nUploading authentication files...");

        const collection = this.database.collection(folder);
        await this.uploadDirectoryImpl(collection, folder);
        console.log("Successfully uploaded authentication files.\n");
    }

    private async uploadDirectoryImpl(collection: Collection, folder: string) {
        const files = readdirSync("./" + folder);
        for (const filename of files) {
            const relativePath = folder + "/" + filename;
            if (!statSync(relativePath).isDirectory()) await this.uploadFile(collection, relativePath);
            else await this.uploadDirectoryImpl(collection, relativePath);
        }

        if (files.length === 0) {  // Empty directory
            const relativePath = folder + "/" + "@";
            await this.uploadFile(collection, relativePath, true);
        }
    }

    public async uploadFile(collection: Collection, relativePath: string, empty = false) {
        const data = empty ? "" : readFileSync(relativePath, { encoding: "base64" });  // Read file contents and encode as base64
        const relativePathNoFolder = relativePath.split("/").slice(1).join("/");
        const wrapped = new WrappedData(relativePathNoFolder, data);
        await collection.insertOne(wrapped);
        console.log("* Uploaded: ", relativePath);
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

        const collection = this.database.collection(folder);
        const documents = await collection.find({ });
        await documents.forEach((document) => {
            this.downloadFile(folder, document as WrappedData);
        });

        console.log("Successfully downloaded authentication files.\n");
    }
}
