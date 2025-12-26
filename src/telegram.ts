export interface TelegramUpdate {
    update_id: number;
    message?: TelegramMessage;
    edited_message?: TelegramMessage;
}

export interface TelegramMessage {
    message_id: number;
    from: TelegramUser;
    chat: TelegramChat;
    date: number;
    text?: string;
    entities?: TelegramMessageEntity[];
}

export interface TelegramUser {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
}

export interface TelegramChat {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
    title?: string;
    username?: string;
}

export interface TelegramMessageEntity {
    type: string;
    offset: number;
    length: number;
    url?: string;
}

export async function sendMessage(token: string, chatId: number | string, text: string, replyToMessageId?: number) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const body: any = {
        chat_id: chatId,
        text: text,
        // parse_mode: 'Markdown', // Optional, can enable if needed for formatting
    };

    if (replyToMessageId) {
        body.reply_to_message_id = replyToMessageId;
    }

    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    return resp.json();
}

/**
 * Forwards a clean link to a target group with attribution.
 */
export async function forwardCleanLinkToGroup(token: string, targetGroupId: string, user: TelegramUser, cleanLinks: string[]) {
    const senderName = user.username ? `@${user.username}` : user.first_name;
    const message = `Shared by ${senderName}:\n\n${cleanLinks.join('\n\n')}`;
    return sendMessage(token, targetGroupId, message);
}

export async function deleteMessage(token: string, chatId: number | string, messageId: number) {
    const url = `https://api.telegram.org/bot${token}/deleteMessage`;
    const body = {
        chat_id: chatId,
        message_id: messageId,
    };

    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}
