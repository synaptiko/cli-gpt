import { load } from 'std/dotenv/mod.ts';
import { join } from 'std/path/mod.ts';
import { prompt } from './prompt.ts';
import { ChatCompletion } from './ChatCompletion.ts';

// TODO: add ability to keep the conversation persistent in a file
// TODO: add ability to reset the conversation
// TODO: add ability to set the role for a message
// TODO: add ability to have initial system message + example conversation which is out of the persisted conversation
// TODO: add ability to read file(s) by specifying them as command line arguments
// TODO: add ability to set the other model params with env vars

const env = await load({
  envPath: join(Deno.env.get('HOME')!, '.cli-gpt'),
});

if (env.OPENAI_KEY === undefined) {
  console.error('OPENAI_KEY environment variable is not set');
  Deno.exit(1);
}

const args = [...Deno.args];

// TODO: iterate over args and check for command line flags
switch (args[0]) {
  case '--user':
  case '-u':
    args.shift();
    // TODO
    break;
  case '--multiline':
  case '-m':
    args.shift();
    // TODO
    break;
  case '--assistent':
  case '-a':
    args.shift();
    // TODO
    break;
  case '--system':
  case '-s':
    args.shift();
    // TODO
    break;
  case '--read':
  case '-r':
    args.shift();
    // TODO
    break;
  case '--reset':
  // deno-lint-ignore no-fallthrough
  case '-e':
    args.shift();
    // TODO
    Deno.exit(0);
  case '--help':
  case '-h':
    // TODO
    Deno.exit(0);
}

let content = args.join(' ');

if (args.length === 0) {
  // TODO: allow multiline prompt with command line flag
  content = await prompt();
}

const chatCompletion = new ChatCompletion(env.OPENAI_KEY, env.MODEL);
const encoder = new TextEncoder();
const write = (chunk: string) => Deno.stdout.write(encoder.encode(chunk));

try {
  for await (const chunk of chatCompletion.complete(content)) {
    write(chunk);
  }
  write('\n');
} catch (error) {
  console.error('Error:', error.message);
  Deno.exit(1);
}
