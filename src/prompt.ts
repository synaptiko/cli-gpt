import readline from 'node:readline';
import process from 'node:process';

export function prompt(multiline = false): Promise<string> {
  const rl = readline.createInterface({
    historySize: 0,
    input: process.stdin,
    output: process.stdout,
    prompt: '',
  });

  return new Promise((resolve) => {
    const text: string[] = [];

    rl.on('line', (line: string) => {
      text.push(line);

      if (!multiline) {
        rl.close();
      }
    });

    rl.on('close', () => {
      resolve(text.join('\n'));
    });
  });
}
