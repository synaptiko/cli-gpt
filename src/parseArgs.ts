import { AssistantCallingFunctionRole, AssistantRole, FunctionResultRole, Role, SystemRole, UserRole } from './ConversationPersistance.ts';

export type Params = {
  flags: Flags;
  role: Exclude<Role, typeof AssistantCallingFunctionRole | typeof FunctionResultRole>;
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
  let role: Params['role'] | undefined;
  const params: Omit<Params, 'role'> = {
    readFiles: undefined,
    prompt: undefined,
    flags: {
      multiline: false,
      affectInitialMessages: false,
      oneShot: false,
      copyResponse: false,
      reset: false,
      help: false,
    },
  };

  while (!argsRead) {
    switch (args[0]) {
      case '--user':
      case '-u':
        if (role !== undefined) {
          console.error('Error: Only one role can be specified.');
          Deno.exit(1);
        }
        args.shift();
        role = UserRole;
        break;
      case '--assistant':
      case '-a':
        if (role !== undefined) {
          console.error('Error: Only one role can be specified.');
          Deno.exit(1);
        }
        args.shift();
        role = AssistantRole;
        break;
      case '--system':
      case '-s':
        if (role !== undefined) {
          console.error('Error: Only one role can be specified.');
          Deno.exit(1);
        }
        args.shift();
        role = SystemRole;
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
      case '-e': {
        const nextArg = args[1];

        args.shift();

        if (nextArg === '--initial' || nextArg === '-i') {
          args.shift();
          params.flags.affectInitialMessages = true;
        }

        if (args.length !== 0) {
          console.error('Error: --reset can only be standalone or together with --initial.');
          Deno.exit(1);
        }

        params.flags.reset = true;
        argsRead = true;
        break;
      }
      case '--help':
      case '-h':
        if (Deno.args.length !== 1) {
          console.error('Error: --help can only be standalone.');
          Deno.exit(1);
        }
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

  const result: Params = { ...params, role: role ?? UserRole };

  validateParams(result);

  return result;
}

function validateParams(params: Params): void {
  if ((params.flags.multiline || params.readFiles) && params.prompt !== undefined) {
    console.error('Error: When using --multiline or --read, the prompt must be provided through stdin.');
    Deno.exit(1);
  }

  if (params.flags.affectInitialMessages && params.flags.oneShot) {
    console.error('Error: --initial and --one-shot cannot be used together.');
    Deno.exit(1);
  }

  if (params.role !== UserRole && params.flags.copyResponse) {
    console.error('Error: --copy can only be used with --user.');
    Deno.exit(1);
  }

  validateFilePaths(params.readFiles);
}

function validateFilePaths(filePaths: string[] = []): void {
  filePaths.forEach((file) => {
    try {
      Deno.statSync(file);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        console.error(`Error: File not found: ${file}`);
        Deno.exit(1);
      } else {
        console.error(`Error: Unable to read file: ${file}`);
        Deno.exit(1);
      }
    }
  });
}
