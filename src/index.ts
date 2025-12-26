import { Hono } from 'hono';
import { extractUrls, unshorten, clean } from './cleaner';
import { TelegramUpdate, sendMessage, forwardCleanLinkToGroup, deleteMessage } from './telegram';

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

        const cleanLinks: string[] = [];
        for (const url of rawUrls) {
            const expanded = await unshorten(url);
            const cleaned = clean(expanded);
            // Only add if it's different or just explicitly valid (for now just add all processed)
            cleanLinks.push(cleaned);
        }

        // Remove duplicates
        const uniqueLinks = [...new Set(cleanLinks)];
        if (uniqueLinks.length === 0) return c.json({ ok: true });

        // 3. Action based on Chat Type
        if (isPrivate) {
            // Post to target group
            const targetGroup = env.TARGET_GROUP_ID;
            if (targetGroup) {
                await forwardCleanLinkToGroup(env.BOT_TOKEN, targetGroup, from, uniqueLinks);
                // Optionally confirm to user?
                await sendMessage(env.BOT_TOKEN, chat.id, `Processed ${uniqueLinks.length} links and sent to group.`);
            } else {
                // If no target group configured, just reply to user
                await sendMessage(env.BOT_TOKEN, chat.id, uniqueLinks.join('\n\n'));
            }
        } else if (isGroup) {
            // Reply in group: "User shared [links]" and delete original
            const senderName = from.username ? `@${from.username}` : from.first_name;
            const replyText = `${senderName} shared links:\n\n${uniqueLinks.join('\n\n')}`;

            await sendMessage(env.BOT_TOKEN, chat.id, replyText);

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
