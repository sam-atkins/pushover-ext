import { z } from "npm:zod@4";

const GlobalArgsSchema = z.object({});

type GlobalArgs = z.infer<typeof GlobalArgsSchema>;

const ResultOutputSchema = z.object({
  statusCode: z.number().int(),
  success: z.boolean(),
  message: z.string(),
  sentAt: z.string(),
});

/**
 * Pushover notification model.
 *
 * Sends push notifications through the Pushover Messages API and records
 * each delivery outcome as a `result` resource.
 */
export const model = {
  type: "@dismal_swamper/pushover",
  version: "2026.08.10.1",
  globalArguments: GlobalArgsSchema,
  resources: {
    result: {
      description: "Result of the Pushover send operation",
      schema: ResultOutputSchema,
      lifetime: "7d",
      garbageCollection: 30,
    },
  },
  methods: {
    send: {
      description: "Send a notification via Pushover",
      arguments: z.object({
        apiToken: z.string().describe(
          "Pushover application API token (from vault)",
        ),
        userKey: z.string().describe("Pushover user key (from vault)"),
        message: z.string().describe("Notification message body"),
        title: z.string().optional().describe("Notification title"),
        priority: z.string().optional().default("0").describe(
          "Notification priority (-2 to 2)",
        ),
      }),
      execute: async (
        args: {
          apiToken: string;
          userKey: string;
          message: string;
          title?: string;
          priority?: string;
        },
        context: {
          globalArgs: GlobalArgs;
          writeResource: (
            specName: string,
            name: string,
            data: Record<string, unknown>,
          ) => Promise<{ name: string }>;
          logger: {
            info: (msg: string, props?: Record<string, unknown>) => void;
            error: (msg: string, props?: Record<string, unknown>) => void;
          };
        },
      ) => {
        const formData = new URLSearchParams();
        formData.append("token", args.apiToken);
        formData.append("user", args.userKey);
        formData.append("message", args.message);
        if (args.title) formData.append("title", args.title);
        formData.append("priority", args.priority ?? "0");

        context.logger.info("Sending Pushover notification: {title}", {
          title: args.title ?? "(no title)",
        });

        const response = await fetch(
          "https://api.pushover.net/1/messages.json",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData.toString(),
          },
        );

        const body = await response.json() as Record<string, unknown>;
        const success = body.status === 1;

        if (!success) {
          context.logger.error(
            "Pushover API returned failure: {statusCode} — {errors}",
            {
              statusCode: response.status,
              errors: JSON.stringify(body.errors ?? body),
            },
          );
          throw new Error(
            `Pushover delivery failed: ${JSON.stringify(body.errors ?? body)}`,
          );
        }

        context.logger.info("Pushover notification sent successfully");

        const handle = await context.writeResource("result", "current", {
          statusCode: response.status,
          success: true,
          message: args.message,
          sentAt: new Date().toISOString(),
        });

        return { dataHandles: [handle] };
      },
    },
  },
};
