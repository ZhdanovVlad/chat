import { Server } from "socket.io";
import express from "express";
import { Room } from "./Room";
import { User } from "./User";

export class ChatServer {
  private io: Server;
  private rooms = new Map<string, Room>();

  constructor(private port: number) {
    const app = express();
    app.use(express.static("public"));
    this.io = new Server(app.listen(port), {
      cors: { origin: "*" }
    });

    console.log(`Сервер запущен на http://localhost:${port}`);

    this.setupEvents();
  }

  private setupEvents(): void {
    this.io.on("connection", (socket) => {
      console.log("Пользователь подключён:", socket.id);

      socket.on("createRoom", (data: { roomName: string; isPublic: boolean; userName: string }) => {
        const { roomName, isPublic, userName } = data;
        const room = this.getOrCreateRoom(roomName, isPublic);
        const user = new User(userName, socket.id);

        socket.join(roomName);
        room.addUser(user);

        socket.currentRoom = roomName;
        socket.currentUserName = userName;

        socket.emit("joinedRoom", {
          room: this.serializeRoom(room),
          user
        });

        this.broadcastUserList(room);
      });

      socket.on("joinRoom", (data: { roomName: string; userName: string }) => {
        const { roomName, userName } = data;
        const room = this.rooms.get(roomName);

        if (!room || (!room.isPublic && !room.getUserBySocketId(socket.id))) {
          socket.emit("error", { message: "Комната не найдена или приватная" });
          return;
        }

        const user = new User(userName, socket.id);
        socket.join(roomName);
        room.addUser(user);

        socket.currentRoom = roomName;
        socket.currentUserName = userName;

        socket.emit("joinedRoom", {
          room: this.serializeRoom(room),
          user
        });

        this.broadcastUserList(room);
      });

      socket.on("toggleVisibility", () => {
        const room = this.getCurrentRoom(socket);
        if (!room) return;

        const user = room.getUserBySocketId(socket.id);
        if (!user) return;

        user.visible = !user.visible;
        this.broadcastUserList(room);

        socket.emit("visibilityToggled", { visible: user.visible });
      });

      socket.on("roomMessage", (text: string) => {
        const room = this.getCurrentRoom(socket);
        const userName = socket.currentUserName;
        if (!room || !userName) return;

        const allUserNames = room.users.map(u => u.name);
        const message = room.addMessage(text, userName, allUserNames);

        this.io.to(room.name).emit("newMessage", message);

        message.mentions.forEach(mentionName => {
          const mentionedUser = room.users.find(u => u.name === mentionName && u.visible);
          if (mentionedUser) {
            this.io.to(mentionedUser.socketId).emit("mention", {
              message,
              from: userName
            });
          }
        });
      });

      socket.on("reaction", (data: { messageId: string; emoji: string }) => {
        const { messageId, emoji } = data;
        const room = this.getCurrentRoom(socket);
        if (!room) return;

        const message = room.messages.find(m => m.id === messageId);
        if (!message) return;

        const userId = room.getUserBySocketId(socket.id)?.id;
        if (!userId) return;

        if (!message.reactions[emoji]) {
          message.reactions[emoji] = [];
        }

        const list = message.reactions[emoji];
        const index = list.indexOf(userId);
        if (index === -1) {
          list.push(userId);
        } else {
          list.splice(index, 1);
        }

        this.io.to(room.name).emit("updateReactions", {
          messageId,
          reactions: message.reactions
        });
      });

      socket.on("disconnect", () => {
        const room = this.getCurrentRoom(socket);
        if (room) {
          room.removeUser(socket.id);
          this.broadcastUserList(room);
        }
        console.log("Пользователь отключён:", socket.id);
      });
    });
  }

  private getOrCreateRoom(name: string, isPublic: boolean): Room {
    if (this.rooms.has(name)) return this.rooms.get(name)!;
    const room = new Room(name, isPublic);
    this.rooms.set(name, room);
    return room;
  }

  private getCurrentRoom(socket: any): Room | null {
    const roomName = socket.currentRoom;
    return this.rooms.get(roomName) || null;
  }

  private broadcastUserList(room: Room): void {
    this.io.to(room.name).emit("userList", room.getVisibleUsers());
  }

  private serializeRoom(room: Room) {
    return {
      name: room.name,
      isPublic: room.isPublic,
      users: room.users,
      messages: room.messages
    };
  }
}
