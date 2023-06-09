// address.ts
// (C) Martin Alebachew, 2023

export enum Server {
    User = "@c.us",  // c.us in selenium-based and puppeteer-based libraries, @s.whatsapp.net in websocket-based libraries
    Group = "@g.us"
}

export class Address {
    private _id: string;
    private _server: Server;
    public serialized: string;

    constructor(id: string, server: Server) {
        this._id = id;
        this._server = server;
        this.serialized = this._serialize();
    }

    public set id (id: string) {
        this._id = id;
        this.serialized = this._serialize();
    }

    public set server (server: Server) {
        this._server = server;
        this.serialized = this._serialize();
    }

    private _serialize() {
        return this._id + this._server;
    }

    public toString() {
        return this.serialized;
    }

    public equals(other: any) {
        return other instanceof Address && this.serialized === other.serialized;
    }

    public static parse(serialized: string): Address | undefined {
        if (serialized.endsWith(Server.User)) {
            const id = serialized.substring(0, serialized.length - Server.User.length);
            return new UserAddress(id);
        } else if (serialized.endsWith(Server.Group)) {
            const id = serialized.substring(0, serialized.length - Server.Group.length);
            return new GroupAddress(id);
        } else return;
    }
}

export class UserAddress extends Address {
    constructor(userId: string) {
        super(userId, Server.User);
    }
}

export class GroupAddress extends Address {
    constructor(groupId: string) {
        super(groupId, Server.Group);
    }
}
