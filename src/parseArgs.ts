import { Role } from './ConversationPersistance.ts';

export type Params = {
  flags: Flags;
  role: Role;
  readFiles: string[] | undefined;
  prompt: string | undefined;
};

export type Flags = {
  multiline: boolean;
  affectInitialMessages: boolean;
  oneShot: boolean;
  copyResponse: boolean;
  reset: boolean;
  help: boolean;
};

export function parseArgs(): Params {
  const args = [...Deno.args];
  let argsRead = false;
  const params: Params = {
    role: 'user' as Role,
    readFiles: undefined,
    prompt: undefined,
    flags: {
      multiline: false,
      affectInitialMessages: false,
      oneShot: false,
      copyResponse: false,
      reset: false,
      help: false
    }
  };

  while (!argsRead) {
    // TODO: add validations
    switch (args[0]) {
      case '--user':
      case '-u':
        args.shift();
        params.role = 'user';
        break;
      case '--assistant':
      case '-a':
        args.shift();
        params.role = 'assistant';
        break;
      case '--system':
      case '-s':
        args.shift();
        params.role = 'system';
        break;
      case '--multiline':
      case '-m':
        args.shift();
        params.flags.multiline = true;
        break;
      case '--read':
      case '-r':
        args.shift();
        params.readFiles = [...args];
        args.splice(0, args.length);
        break;
      case '--initial':
      case '-i':
        args.shift();
        params.flags.affectInitialMessages = true;
        break;
      case '--one-shot':
      case '-o':
        args.shift();
        params.flags.oneShot = true;
        break;
      case '--copy':
      case '-c':
        args.shift();
        params.flags.copyResponse = true;
        break;
      case '--reset':
      case '-e':
        params.flags.reset = true;
        argsRead = true;
        break;
      case '--help':
      case '-h':
        params.flags.help = true;
        argsRead = true;
        break;
    }

    if (!argsRead) {
      argsRead = args.length === 0 || !args[0].startsWith('-');
    }
  }

  if (args.length !== 0) {
    params.prompt = args.join(' ');
  }

  return params;
}
