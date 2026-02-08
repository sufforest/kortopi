
import { describe, it, expect, vi, beforeEach } from 'vitest';
import app from '../src/index';

// Mock the dependencies
vi.mock('../src/cleaner', async () => {
    const actual = await vi.importActual('../src/cleaner');
    return {
        ...actual,
        unshorten: vi.fn(), // We will mock implementations per test
    };
});

import { unshorten } from '../src/cleaner';

describe('POST /webhook', () => {
    // Helper to simulate Telegram Update
    const createUpdate = (text: string, chatType: 'private' | 'group' = 'private', userId = 123, username = 'testuser') => ({
        update_id: 1,
        message: {
            message_id: 100,
            from: {
                id: userId,
                is_bot: false,
                first_name: 'Test',
                last_name: 'User',
                username: username
            },
            chat: {
                id: chatType === 'private' ? userId : -1001,
                type: chatType
            },
            date: 1234567890,
            text: text
        }
    });

    const mockEnv = {
        BOT_TOKEN: 'fake-token',
        ALLOWED_USERS: '123',
        ALLOWED_GROUPS: '-1001',
        TARGET_GROUP_ID: ''
    };

    // Mock fetch for sendMessage/deleteMessage
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: {} }),
    } as unknown as Response);

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset default implementation
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ok: true, result: {} }),
        } as unknown as Response);
    });

    it('ignores messages without links', async () => {
        const res = await app.request('/webhook', {
            method: 'POST',
            body: JSON.stringify(createUpdate('Hello world')),
        }, mockEnv);

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: true });
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('replaces links in private chat', async () => {
        // Mock unshorten to just return the URL (no Shortener)
        vi.mocked(unshorten).mockImplementation(async (url) => url);

        // Input: Dirty URL
        const dirtyUrl = 'https://www.bilibili.com/video/BV1?spm=123';
        // Clean logic (from actual cleaner.ts) should strip spm

        const res = await app.request('/webhook', {
            method: 'POST',
            body: JSON.stringify(createUpdate(`Check this: ${dirtyUrl}`)),
        }, mockEnv);

        expect(res.status).toBe(200);

        // Should send message back
        expect(global.fetch).toHaveBeenCalledTimes(1);
        const callArgs = vi.mocked(global.fetch).mock.calls[0];
        const url = callArgs[0] as string;
        const body = JSON.parse(callArgs[1].body as string);

        expect(url).toContain('/sendMessage');
        expect(body.chat_id).toBe(123);
        // Correct replacement verification
        expect(body.text).toContain('Check this: https://www.bilibili.com/video/BV1');
        expect(body.text).not.toContain('spm=123');
    });

    it('replaces links in group chat and deletes original', async () => {
        vi.mocked(unshorten).mockImplementation(async (url) => url);

        const dirtyUrl = 'https://www.bilibili.com/video/BV1?spm=123';

        const res = await app.request('/webhook', {
            method: 'POST',
            body: JSON.stringify(createUpdate(`Look: ${dirtyUrl}`, 'group')),
        }, mockEnv);

        expect(res.status).toBe(200);

        // Should call sendMessage AND deleteMessage
        expect(global.fetch).toHaveBeenCalledTimes(2);

        // Check sendMessage
        const sendCall = vi.mocked(global.fetch).mock.calls.find(c => (c[0] as string).includes('sendMessage'));
        const sendBody = JSON.parse(sendCall[1].body as string);
        expect(sendBody.text).toContain('<b><a href="tg://user?id=123">Test User (@testuser)</a></b>:'); // Bold Sender Name + Link
        expect(sendBody.text).toContain('Look: https://www.bilibili.com/video/BV1');
        expect(sendBody.parse_mode).toBe('HTML');

        // Check deleteMessage
        const deleteCall = vi.mocked(global.fetch).mock.calls.find(c => (c[0] as string).includes('deleteMessage'));
        const deleteBody = JSON.parse(deleteCall[1].body as string);
        expect(deleteBody.message_id).toBe(100);
    });

    it('handles multiple links correctly', async () => {
        vi.mocked(unshorten).mockImplementation(async (url) => url);

        // Assume generic domain strips all params (from global blacklist? No, generic only strips blacklisted)
        // Let's use Bilibili again to be sure
        const text2 = 'V1: https://www.bilibili.com/v/1?spm=a V2: https://www.bilibili.com/v/2?spm=b';

        const res = await app.request('/webhook', {
            method: 'POST',
            body: JSON.stringify(createUpdate(text2)),
        }, mockEnv);

        const call = vi.mocked(global.fetch).mock.calls[0];
        const body = JSON.parse(call[1].body as string);

        expect(body.text).toContain('V1: https://www.bilibili.com/v/1');
        expect(body.text).not.toContain('?spm=');
        expect(body.text).toContain('V2: https://www.bilibili.com/v/2');
    });
});
