# Kortopi - Telegram Link Cleaner Bot

Kortopi is a Telegram bot running on Cloudflare Workers that automatic cleaning of tracking parameters (like `utm_*`, `fbclid`) from shared links, protecting privacy and keeping groups clean.

## Features

*   **Link Cleaning**: Automatically removes tracking parameters and resolves redirects.
*   **Group Interaction**: "Delete & Repost" mechanism to maintain chat cleanliness.
*   **Permissions**: Whitelist support for users and groups.

## Deployment Guide (Cloudflare Workers)

No server required. You can deploy this using the free tier of Cloudflare Workers.

### 1. Prerequisites
*   [Cloudflare](https://dash.cloudflare.com/) Account.
*   [Telegram Bot Token](https://t.me/BotFather) (via @BotFather).
*   `Node.js` and `npm` installed.

### 2. Configuration

Clone the code and install dependencies:
```bash
npm install
```

#### Environment Variables

We recommend putting non-sensitive config in `wrangler.toml` and sensitive config (like Tokens) in Cloudflare Secrets.

1.  **Modify `wrangler.toml`** (Non-sensitive):
    ```toml
    [vars]
    # Comma-separated User IDs allowed to PM the bot. Leave empty for no restriction.
    ALLOWED_USERS = "12345678"
    
    # Comma-separated Group IDs where the bot is active.
    ALLOWED_GROUPS = "-100xxxxxxx,-100yyyyyyy"
    
    # (Optional) Target Group ID to forward private messages to.
    TARGET_GROUP_ID = "-100xxxxxxx"
    ```

2.  **Set Secrets** (Sensitive):
    Set the Bot Token via command line. Do not commit this to code.
    ```bash
    npx wrangler secret put BOT_TOKEN
    ```
    *(Enter your Telegram Bot Token when prompted)*

### 3. Deploy

```bash
npm run deploy
```

After success, you will get a Worker URL like `https://kortopi.your-subdomain.workers.dev`.

### 4. Set Telegram Webhook

You need to tell Telegram to push messages to your Worker. Replace `<YOUR_WORKER_URL>` and `<BOT_TOKEN>` below and run in terminal:

```bash
curl -F "url=https://<YOUR_WORKER_URL>/webhook" https://api.telegram.org/bot<BOT_TOKEN>/setWebhook
```

## Development

Start local dev server:
```bash
# Set local env vars first
echo "BOT_TOKEN=your_fake_token" > .dev.vars
npm run dev
```

## Customizing Rules

All cleaning rules are in `src/config.ts`. You can adjust the global blocklist or domain-specific rules there.
