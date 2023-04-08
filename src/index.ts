import { load } from 'std/dotenv/mod.ts';
import { join } from 'std/path/mod.ts';
import { writeText as copyToClipboard } from 'copy_paste/mod.ts';
import { prompt } from './prompt.ts';
import { ChatCompletion } from './ChatCompletion.ts';
import { printHelp } from './printHelp.ts';
import { ConversationPersistance, Role } from './ConversationPersistance.ts';

// TODO: finish the README
// TODO: add ability to set the other model params with env vars

const env = await load({
  envPath: join(Deno.env.get('HOME')!, '.cli-gpt'),
});

if (env.OPENAI_API_KEY === undefined) {
  console.error('OPENAI_API_KEY environment variable is not set');
  Deno.exit(1);
}

const args = [...Deno.args];
let argsRead = false;
let role: Role = 'user';
let multiline = false;
let readFiles;
let affectInitialMessages = false;
let oneShot = false;
let copyResponse = false;
let reset = false;
let help = false;

while (!argsRead) {
  // TODO: add validations
  switch (args[0]) {
    case '--user':
    case '-u':
      args.shift();
      role = 'user';
      break;
    case '--assistent':
    case '-a':
      args.shift();
      role = 'assistent';
      break;
    case '--system':
    case '-s':
      args.shift();
      role = 'system';
      break;
    case '--multiline':
    case '-m':
      args.shift();
      multiline = true;
      break;
    case '--read':
    case '-r':
      args.shift();
      readFiles = [...args];
      args.splice(0, args.length);
      break;
    case '--initial':
    case '-i':
      args.shift();
      affectInitialMessages = true;
      break;
    case '--one-shot':
    case '-o':
      args.shift();
      oneShot = true;
      break;
    case '--copy':
    case '-c':
      args.shift();
      copyResponse = true;
      break;
    case '--reset':
    case '-e':
      reset = true;
      argsRead = true;
      break;
    case '--help':
    case '-h':
      help = true;
      argsRead = true;
      break;
  }

  if (!argsRead) {
    argsRead = args.length === 0 || !args[0].startsWith('-');
  }
}

const conversationPersistance = new ConversationPersistance();

if (help) {
  printHelp();
} else if (reset) {
  conversationPersistance.reset(affectInitialMessages);
} else {
  let content;

  if (readFiles !== undefined) {
    const filesContent = await Promise.all(readFiles.map(async (file) => {
      const fileContent = await Deno.readTextFile(file);
      return `${file}:\n\`\`\`\n${fileContent}\n\`\`\`\n`;
    }));

    content = filesContent.join('\n');
    console.log(content);
  }

  if (multiline || args.length === 0) {
    content = (content ?? '') + await prompt(multiline);
    console.log('\nResponse:');
  } else {
    content = args.join(' ');
  }

  if (!oneShot) {
    conversationPersistance.append({
      role,
      content,
      affectInitialMessages,
    });
  }

  if (role === 'user') {
    const chatCompletion = new ChatCompletion(env.OPENAI_API_KEY, env.MODEL);
    const encoder = new TextEncoder();
    const write = (chunk: string) => Deno.stdout.write(encoder.encode(chunk));
    const responseContent = [];

    if (oneShot) {
      chatCompletion.setMessages([{ role: 'user', content }]);
    } else {
      chatCompletion.setMessages(conversationPersistance.getMessages());
    }

    try {
      for await (const chunk of chatCompletion.complete()) {
        responseContent.push(chunk);
        write(chunk);
      }
      write('\n');

      if (copyResponse) {
        copyToClipboard(responseContent.join(''));
      }

      if (!oneShot) {
        conversationPersistance.append({
          role: 'assistent',
          content: responseContent.join(''),
          affectInitialMessages,
        });
      }
    } catch (error) {
      console.error('Error:', error.message);
      Deno.exit(1);
    }
  }
}
