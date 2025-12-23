import { User } from './User';

export class Message {
  public readonly id: string;
  public readonly timestamp: number;
  public readonly reactions: Record<string, string[]> = {};
  public readonly mentions: string[] = [];

  constructor(
    public readonly text: string,
    public readonly author: string,
    allUserNames: string[]
  ) {
    this.id = Math.random().toString(36).substr(2, 9);
    this.timestamp = Date.now();
    this.mentions = this.extractMentions(text, allUserNames);
  }

  private extractMentions(text: string, userNames: string[]): string[] {
    const words = text.split(/\s+/);
    return words
      .filter(word => word.startsWith('@'))
      .map(word => word.slice(1))
      .filter(name => userNames.includes(name));
  }
}

export class Room {
  public readonly users: User[] = [];
  public readonly messages: Message[] = [];

  constructor(
    public readonly name: string,
    public readonly isPublic: boolean
  ) {}

  addUser(user: User): void {
    this.users.push(user);
  }

  removeUser(socketId: string): void {
    const index = this.users.findIndex(u => u.socketId === socketId);
    if (index !== -1) this.users.splice(index, 1);
  }

  getUserBySocketId(socketId: string): User | undefined {
    return this.users.find(u => u.socketId === socketId);
  }

  addMessage(text: string, author: string, allUserNames: string[]): Message {
    const msg = new Message(text, author, allUserNames);
    this.messages.push(msg);
    return msg;
  }

  getVisibleUsers(): User[] {
    return this.users.filter(u => u.visible);
  }
}
