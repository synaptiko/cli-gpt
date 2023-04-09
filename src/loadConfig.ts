import { load } from 'std/dotenv/mod.ts';
import { join } from 'std/path/mod.ts';

export type Config = {
  api_key: string;
  model: string;
  temperature?: number;
  top_p?: number;
  n?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  stop?: string | string[];
  logit_bias?: Record<string, number>;
};

function validateParam<T>(
  paramName: string,
  parseValue: () => T | undefined,
  isValid: (value: T) => boolean,
): T | undefined {
  try {
    const value = parseValue();

    if (value === undefined) {
      return undefined;
    }

    if (!isValid(value)) {
      throw new Error(`Invalid value for parameter ${paramName}: ${value}`);
    }

    return value;
  } catch (error) {
    console.error(`Error parsing parameter ${paramName}: ${error.message}`);
    Deno.exit(1);
  }
}

export async function loadConfig(): Promise<Config> {
  const env = await load({
    envPath: join(Deno.env.get('HOME')!, '.cli-gpt'),
  });

  if (env.OPENAI_API_KEY === undefined) {
    console.error('OPENAI_API_KEY environment variable is not set');
    Deno.exit(1);
  }

  return {
    api_key: env.OPENAI_API_KEY,
    model: env.MODEL ?? 'gpt-4',
    temperature: validateParam<number>(
      'temperature',
      () =>
        env.TEMPERATURE !== undefined ? parseFloat(env.TEMPERATURE) : undefined,
      (value) => value >= 0 && value <= 2,
    ),
    top_p: validateParam<number>(
      'top_p',
      () => (env.TOP_P !== undefined ? parseFloat(env.TOP_P) : undefined),
      (value) => value >= 0 && value <= 1,
    ),
    n: validateParam<number>(
      'n',
      () => (env.N !== undefined ? parseInt(env.N) : undefined),
      (value) => value > 0,
    ),
    max_tokens: validateParam<number>(
      'max_tokens',
      () => (env.MAX_TOKENS !== undefined ? parseInt(env.MAX_TOKENS) : undefined),
      (value) => value >= 0,
    ),
    presence_penalty: validateParam<number>(
      'presence_penalty',
      () =>
        env.PRESENCE_PENALTY !== undefined
          ? parseFloat(env.PRESENCE_PENALTY)
          : undefined,
      (value) => value >= -2 && value <= 2,
    ),
    frequency_penalty: validateParam<number>(
      'frequency_penalty',
      () =>
        env.FREQUENCY_PENALTY !== undefined
          ? parseFloat(env.FREQUENCY_PENALTY)
          : undefined,
      (value) => value >= -2 && value <= 2,
    ),
    stop: validateParam<string | string[]>(
      'stop',
      () => (env.STOP !== undefined ? JSON.parse(env.STOP) : undefined),
      (value) =>
        (typeof value === 'string' && value.trim() !== '') ||
        (Array.isArray(value) && value.length > 0 && value.length <= 4),
    ),
    logit_bias: validateParam<Record<string, number>>(
      'logit_bias',
      () => (env.LOGIT_BIAS !== undefined ? JSON.parse(env.LOGIT_BIAS) : undefined),
      (value) => {
        for (const bias of Object.values(value)) {
          if (bias < -100 || bias > 100) return false;
        }
        return true;
      },
    ),
  }
}
