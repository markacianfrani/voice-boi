export class UI {
  private CLEAR_LINE = '\x1b[2K\r';
  private BOLD = '\x1b[1m';
  private GREEN = '\x1b[32m';
  private BLUE = '\x1b[34m';
  private YELLOW = '\x1b[33m';
  private RESET = '\x1b[0m';

  print(message: string): void {
    console.log(message);
  }

  write(text: string): void {
    process.stdout.write(text);
  }

  clearLine(): void {
    process.stdout.write(this.CLEAR_LINE);
  }
}
