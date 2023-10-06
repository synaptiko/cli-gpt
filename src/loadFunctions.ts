import { join } from 'std/path/mod.ts';
import { FunctionDefinition } from './ChatCompletion.ts';

const pluginsPath = join(Deno.env.get('HOME')!, '.cli-gpt-plugins');

type FunctionsMap = Record<string, (args: string) => Promise<string>>;

function createCommandWrapper(functionName: string) {
  const commandPath = join(pluginsPath, functionName);

  // TODO: handle errors

  return async function (args: string): Promise<string> {
    const command = new Deno.Command(commandPath, { args: [args] });
    const { stdout, stderr } = await command.output();

    // TODO: remove this debugging log
    console.log('[DEBUG]: ', new TextDecoder().decode(stderr));

    return new TextDecoder().decode(stdout);
  };
}

export async function loadFunctions(): Promise<{ definitions?: FunctionDefinition[]; functions: FunctionsMap }> {
  const definitions: FunctionDefinition[] = [];
  const functions: FunctionsMap = {};

  for await (const dirEntry of Deno.readDir(pluginsPath)) {
    if (dirEntry.name.endsWith('.def.json')) {
      const functionName = dirEntry.name.replace(/\.def\.json$/, '');

      // check existence of actual function/plugin executable and its permissions; only then load the definition
      try {
        const fileInfo = await Deno.stat(join(pluginsPath, functionName));

        if (!(fileInfo.isFile && (fileInfo.mode ?? 0o000) & 0o100)) {
          continue;
        }
      } catch (_ignore) {
        continue;
      }

      definitions.push(JSON.parse(await Deno.readTextFile(join(pluginsPath, dirEntry.name))));
      functions[functionName] = createCommandWrapper(functionName);
    }
  }

  return {
    definitions: definitions.length > 0 ? definitions : undefined,
    functions
  };
}
