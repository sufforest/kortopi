import { Hono } from 'hono';
import { extractUrls, unshorten, clean } from './cleaner';
import { TelegramUpdate, sendMessage, deleteMessage, escapeHtml } from './telegram';

type Bindings = {
    ALLOWED_USERS: string;
    ALLOWED_GROUPS: string;
    TARGET_GROUP_ID: string;
    BOT_TOKEN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', (c) => c.text('Kortopi Bot is running.'));

app.post('/webhook', async (c) => {
    try {
        const update: TelegramUpdate = await c.req.json();

        // We only care about messages (for now)
        const message = update.message || update.edited_message;
        if (!message || !message.text) {
            return c.json({ ok: true }); // Ignore non-text messages
        }

        const { chat, from, text } = message;
        const env = c.env;

        // 1. Permission Check
        const allowedUsers = (env.ALLOWED_USERS || '').split(',').map(s => s.trim()).filter(Boolean);
        const allowedGroups = (env.ALLOWED_GROUPS || '').split(',').map(s => s.trim()).filter(Boolean);

        const isPrivate = chat.type === 'private';
        const isGroup = ['group', 'supergroup'].includes(chat.type);

        if (isPrivate) {
            if (allowedUsers.length > 0 && !allowedUsers.includes(String(from.id))) {
                console.log(`User ${from.id} not allowed.`);
                return c.json({ ok: true }); // Silent ignore
            }
        } else if (isGroup) {
            if (allowedGroups.length > 0 && !allowedGroups.includes(String(chat.id))) {
                console.log(`Group ${chat.id} not allowed.`);
                return c.json({ ok: true }); // Silent ignore
            }
        } else {
            // Channel or unknown type, ignore
            return c.json({ ok: true });
        }

        // 2. Extract and Clean URLs
        const rawUrls = extractUrls(text);
        if (rawUrls.length === 0) {
            return c.json({ ok: true });
        }

        let newText = text;
        let modified = false;

        // Sort by length desc to avoid replacement collisions
        const uniqueRawUrls = [...new Set(rawUrls)].sort((a, b) => b.length - a.length);

        for (const url of uniqueRawUrls) {
            try {
                const expanded = await unshorten(url);
                const cleaned = clean(expanded);

                if (cleaned !== url) {
                    newText = newText.replaceAll(url, cleaned);
                    modified = true;
                }
            } catch (e) {
                console.error(`Error processing URL ${url}:`, e);
            }
        }

        if (!modified) {
            return c.json({ ok: true });
        }

        // 3. Action based on Chat Type
        if (isPrivate) {
            // Post to target group
            const targetGroup = env.TARGET_GROUP_ID;
            if (targetGroup) {
                const safeFirstName = escapeHtml(from.first_name);
                const safeLastName = from.last_name ? escapeHtml(from.last_name) : '';
                const safeUsername = from.username ? escapeHtml(from.username) : '';

                const displayName = [safeFirstName, safeLastName].filter(Boolean).join(' ') + (safeUsername ? ` (@${safeUsername})` : '');
                // Bold + Link to user profile
                const boldSenderName = `<b><a href="tg://user?id=${from.id}">${displayName}</a></b>`;

                await sendMessage(env.BOT_TOKEN, targetGroup, `Forwarded from ${boldSenderName}:\n\n${escapeHtml(newText)}`, undefined, 'HTML');
                await sendMessage(env.BOT_TOKEN, chat.id, `Processed and sent to group.`);
            } else {
                // If no target group configured, just reply to user
                await sendMessage(env.BOT_TOKEN, chat.id, newText);
            }
        } else if (isGroup) {
            // Reply in group: "User shared [links]" and delete original
            const safeFirstName = escapeHtml(from.first_name);
            const safeLastName = from.last_name ? escapeHtml(from.last_name) : '';
            const safeUsername = from.username ? escapeHtml(from.username) : '';

            const displayName = [safeFirstName, safeLastName].filter(Boolean).join(' ') + (safeUsername ? ` (@${safeUsername})` : '');
            const boldSenderName = `<b><a href="tg://user?id=${from.id}">${displayName}</a></b>`;

            const replyText = `${boldSenderName}:\n${escapeHtml(newText)}`;

            await sendMessage(env.BOT_TOKEN, chat.id, replyText, undefined, 'HTML');

            // Try to delete original message
            await deleteMessage(env.BOT_TOKEN, chat.id, message.message_id).catch(e => console.error('Failed to delete message', e));
        }

        return c.json({ ok: true });
    } catch (err) {
        console.error('Error processing webhook:', err);
        return c.json({ ok: false, error: 'Internal Server Error' }, 500);
    }
});

export default app;
