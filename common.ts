export const queryEnv = async (
  envKey: string,
  defaultValue: string,
): Promise<string> => {
  if (Deno.permissions) {
    const { state } = await Deno.permissions.query({
      name: "env",
      variable: envKey,
    });
    if (state !== "granted") return defaultValue;
  }
  return Deno.env.get(envKey) || defaultValue;
};

export class EnvError extends Error {
}

export const requireEnv = async (envKey: string): Promise<string> => {
  if (Deno.permissions) {
    const { state } = await Deno.permissions.query({
      name: "env",
      variable: envKey,
    });
    if (state !== "granted") {
      throw new EnvError(
        `Did not have permission to read environment variable ${envKey}`,
      );
    }
  }
  const result = Deno.env.get(envKey);
  if (result === undefined) {
    throw new EnvError(
      `Environment variable ${envKey} not set`,
    );
  }
  return result;
};

export const jsonResponse = (
  object: any,
  additionalResponseOptions?: ResponseInit,
) => {
  const headers = Object.assign({}, additionalResponseOptions?.headers || {}, {
    headers: {
      "content-type": "application/json; charset=utf8",
    },
  });
  const options = Object.assign({}, additionalResponseOptions, { headers });
  return new Response(JSON.stringify(object), options);
};

export class HttpError extends Error {
  status: number;

  constructor(message: string, name: string, status = 500) {
    super(message);
    this.name = name;
    this.status = status;
  }

  toResponse() {
    const { name, status, message } = this;
    return jsonResponse({ id: name, status, message }, { status: status });
  }
}
