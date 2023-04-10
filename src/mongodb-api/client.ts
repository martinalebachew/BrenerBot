// client.ts
// (C) Martin Alebachew, 2023

import { MongoClient, Db, Collection } from "mongodb";
import { rmSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const DATABASE = "whatsapp-api";
const COLLECTION = "auth_files";

class WrappedData {
    public filename: string;
    public data: any;

    constructor(filename: string, data: any) {
        this.filename = filename;
        this.data = data;
    }
}

export class Client {
    private connection: MongoClient;
    private database: Db;
    private collection: Collection;

    constructor(username: string, password: string, endpoint: string) {
        const uri = `mongodb+srv://${username}:${password}@${endpoint}/?retryWrites=true&w=majority`;
        this.connection = new MongoClient(uri);
        this.database = this.connection.db(DATABASE);
        this.collection = this.database.collection(COLLECTION);
    }

    public async closeConnection() {
        await this.connection.close();
    }

    public async save(filename: string, data: any) {
        const wrapped = new WrappedData(filename, data);
        await this.collection.insertOne(wrapped);
    }

    public async update(filename: string, data: any) {
        await this.remove(filename);
        await this.save(filename, data);
    }

    public async remove(filename: string) {
        const query = { filename: filename };
        await this.collection.deleteOne(query);
    }

    public async downloadAll(folder: string) {
        console.log("\nDownloading authentication files...");
        rmSync(folder, { recursive: true, force: true });
        mkdirSync(folder);
        const documents = await this.collection.find({ });
        await documents.forEach((document) => {
            const filename = document.filename;
            delete document.filename;

            writeFileSync(join(folder, filename), document.data);
            console.log("* Downloaded: ", filename);
        });

        console.log("Successfully downloaded authentication files.\n");
    }
}
