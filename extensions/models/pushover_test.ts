import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { model } from "./pushover.ts";

function mockFetch(status: number, body: unknown): typeof fetch {
  return (async (_url: string | URL | Request, _init?: RequestInit) => {
    return {
      ok: true,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response;
  }) as typeof fetch;
}

function mockLogger() {
  const calls: string[] = [];
  return {
    info: (_msg: string) => {},
    error: (_msg: string) => {},
    calls,
  };
}

function mockWriteResource() {
  const writes: {
    specName: string;
    name: string;
    data: Record<string, unknown>;
  }[] = [];
  return {
    writeResource: async (
      specName: string,
      name: string,
      data: Record<string, unknown>,
    ) => {
      writes.push({ specName, name, data });
      return { name };
    },
    writes,
  };
}

Deno.test("Pushover - successful send writes result resource", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch(200, { status: 1, request: "abc123" });

  try {
    const writeResource = mockWriteResource();
    const context = {
      globalArgs: {},
      writeResource: writeResource.writeResource,
      logger: mockLogger(),
    };

    const result = await model.methods.send.execute(
      { apiToken: "token", userKey: "user", message: "hello", title: "Test" },
      context,
    );

    assertEquals(writeResource.writes.length, 1);
    assertEquals(writeResource.writes[0].specName, "result");
    assertEquals(writeResource.writes[0].name, "current");
    assertEquals(writeResource.writes[0].data.success, true);
    assertEquals(writeResource.writes[0].data.message, "hello");
    assertEquals(result.dataHandles!.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("Pushover - throws when API returns status != 1", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch(400, { status: 0, errors: ["invalid token"] });

  try {
    const context = {
      globalArgs: {},
      writeResource: async () => ({ name: "x" }),
      logger: mockLogger(),
    };

    await assertRejects(
      () =>
        model.methods.send.execute(
          { apiToken: "bad", userKey: "user", message: "hi" },
          context,
        ),
      Error,
      "Pushover delivery failed",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("Pushover - sends correct form-encoded body with all fields", async () => {
  const originalFetch = globalThis.fetch;
  const fetchCalls: { init?: RequestInit }[] = [];

  globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
    fetchCalls.push({ init });
    return {
      ok: true,
      status: 200,
      json: async () => ({ status: 1 }),
      text: async () => "",
    } as Response;
  }) as typeof fetch;

  try {
    const context = {
      globalArgs: {},
      writeResource: async () => ({ name: "x" }),
      logger: mockLogger(),
    };

    await model.methods.send.execute(
      {
        apiToken: "app-token",
        userKey: "user-key",
        message: "body text",
        title: "Title",
        priority: "1",
      },
      context,
    );

    assertEquals(fetchCalls.length, 1);
    const body = fetchCalls[0].init!.body as string;
    assertEquals(
      fetchCalls[0].init!.headers!["Content-Type" as keyof HeadersInit],
      "application/x-www-form-urlencoded",
    );
    assertEquals(fetchCalls[0].init!.method, "POST");
    const params = new URLSearchParams(body);
    assertEquals(params.get("token"), "app-token");
    assertEquals(params.get("user"), "user-key");
    assertEquals(params.get("message"), "body text");
    assertEquals(params.get("title"), "Title");
    assertEquals(params.get("priority"), "1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("Pushover - uses default priority when not provided", async () => {
  const originalFetch = globalThis.fetch;
  const fetchCalls: { init?: RequestInit }[] = [];

  globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
    fetchCalls.push({ init });
    return {
      ok: true,
      status: 200,
      json: async () => ({ status: 1 }),
      text: async () => "",
    } as Response;
  }) as typeof fetch;

  try {
    const context = {
      globalArgs: {},
      writeResource: async () => ({ name: "x" }),
      logger: mockLogger(),
    };

    await model.methods.send.execute(
      { apiToken: "token", userKey: "user", message: "msg" },
      context,
    );

    const body = fetchCalls[0].init!.body as string;
    assertEquals(new URLSearchParams(body).get("priority"), "0");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("Pushover - omits title from form body when not provided", async () => {
  const originalFetch = globalThis.fetch;
  const fetchCalls: { init?: RequestInit }[] = [];

  globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
    fetchCalls.push({ init });
    return {
      ok: true,
      status: 200,
      json: async () => ({ status: 1 }),
      text: async () => "",
    } as Response;
  }) as typeof fetch;

  try {
    const context = {
      globalArgs: {},
      writeResource: async () => ({ name: "x" }),
      logger: mockLogger(),
    };

    await model.methods.send.execute(
      { apiToken: "token", userKey: "user", message: "msg" },
      context,
    );

    const body = fetchCalls[0].init!.body as string;
    assertEquals(new URLSearchParams(body).has("title"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
