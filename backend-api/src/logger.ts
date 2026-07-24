const logs: string[] = [];

export function logEvent(message: string): void {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  logs.push(line);
  if (logs.length > 500) {
    logs.shift();
  }
}

export function getLogs(): string {
  return logs.join('\n');
}
