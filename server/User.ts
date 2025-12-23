export class User {
  public readonly id: string;
  public visible: boolean = true;

  constructor(
    public readonly name: string,
    public readonly socketId: string
  ) {
    this.id = Math.random().toString(36).substr(2, 9);
  }
}
