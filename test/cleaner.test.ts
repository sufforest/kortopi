
import { describe, it, expect, vi } from 'vitest';
import { extractUrls, clean, unshorten } from '../src/cleaner';

describe('extractUrls', () => {
    it('extracts single URL', () => {
        expect(extractUrls('Check this https://example.com')).toEqual(['https://example.com']);
    });

    it('extracts multiple URLs', () => {
        const text = 'Link 1: https://a.com, Link 2: http://b.com/foo';
        expect(extractUrls(text)).toEqual(['https://a.com', 'http://b.com/foo']);
    });

    it('extracts URL with query params', () => {
        expect(extractUrls('https://example.com?foo=bar&baz=1')).toEqual(['https://example.com?foo=bar&baz=1']);
    });

    it('returns empty array when no URL', () => {
        expect(extractUrls('Hello world')).toEqual([]);
    });
});

describe('clean', () => {
    it('removes tracking params from generic domains (blacklist)', () => {
        const url = 'https://example.com?utm_source=twitter&utm_medium=social&fbclid=123&si=456&other=keep';
        // si is in global blacklist from config.ts
        const cleaned = clean(url);
        expect(cleaned).toContain('other=keep');
        expect(cleaned).not.toContain('utm_source');
        expect(cleaned).not.toContain('fbclid');
        expect(cleaned).not.toContain('si=456');
    });

    it('handles Bilibili (whitelist)', () => {
        // config.ts: bilibili.com whitelist: ['p', 't']
        const url = 'https://www.bilibili.com/video/BV1xx411c7mD?spm_id_from=333.999.0.0&vd_source=123&p=2';
        const cleaned = clean(url);
        expect(cleaned).toContain('p=2');
        expect(cleaned).not.toContain('spm_id_from');
        expect(cleaned).not.toContain('vd_source');
    });

    it('handles Xiaohongshu (whitelist)', () => {
        // config.ts: xiaohongshu.com whitelist: ['xsec_token']
        const url = 'https://www.xiaohongshu.com/discovery/item/64f123?app_platform=ios&app_version=8.0&xsec_token=AB123';
        const cleaned = clean(url);
        expect(cleaned).toContain('xsec_token=AB123');
        expect(cleaned).not.toContain('app_platform');
    });

    it('handles Zhihu (whitelist empty)', () => {
        // config.ts: zhihu.com whitelist: [] (strip all)
        const url = 'https://www.zhihu.com/question/12345?utm_source=wechat';
        const cleaned = clean(url);
        expect(cleaned).toBe('https://www.zhihu.com/question/12345');
    });

    it('handles Youtube (blacklist)', () => {
        // config.ts: youtube.com blacklist: ['si']
        const url = 'https://youtu.be/dQw4w9WgXcQ?si=abcdef&t=10';
        const cleaned = clean(url);
        expect(cleaned).not.toContain('si=');
        expect(cleaned).toContain('t=10');
    });
});

describe('unshorten', () => {
    it('resolves redirects', async () => {
        const originalFetch = global.fetch;

        // Mock fetch to return a sequence of responses
        // First call: 301 Redirect to long-url
        // Second call: 200 OK at long-url
        const mockFetch = vi.fn()
            .mockResolvedValueOnce({
                status: 301,
                headers: { get: () => 'https://long-url.com' },
                text: () => Promise.resolve(''),
            } as unknown as Response)
            .mockResolvedValueOnce({
                status: 200,
                headers: { get: () => null },
                text: () => Promise.resolve(''),
            } as unknown as Response);

        global.fetch = mockFetch;

        const result = await unshorten('https://short.com/xyz');
        expect(result).toBe('https://long-url.com/');
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockFetch).toHaveBeenNthCalledWith(1, 'https://short.com/xyz', expect.any(Object));
        expect(mockFetch).toHaveBeenNthCalledWith(2, 'https://long-url.com/', expect.any(Object));

        global.fetch = originalFetch;
    });

    it('returns original if fetch fails', async () => {
        const originalFetch = global.fetch;
        global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const result = await unshorten('https://short.com/fail');
        expect(result).toBe('https://short.com/fail');

        global.fetch = originalFetch;
    });
});
