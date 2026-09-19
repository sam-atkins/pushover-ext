# @dismal_swamper/pushover

Sends push notifications through the Pushover API. It reports the delivery
status, the message that was sent, and the timestamp.

## Usage

Create a model definition:

```bash
swamp model create @dismal_swamper/pushover my-pushover
```

Edit the generated definition to set the `send` arguments, resolving the
credentials from a vault:

```yaml
methods:
  send:
    arguments:
      apiToken: ${{ vault.get("my-secrets", "PUSHOVER_API_TOKEN") }}
      userKey: ${{ vault.get("my-secrets", "PUSHOVER_USER_KEY") }}
      message: "Deploy complete"
      title: "Deployment"
      priority: "1"
```

`title` is optional and `priority` (-2 to 2) defaults to `0`.

Run the `send` method:

```bash
swamp model method run my-pushover send
```

## Output

The `result` resource has `statusCode`, `success`, `message`, and `sentAt`
fields.
