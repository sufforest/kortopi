import { config } from './config';

export async function unshorten(url: string, maxRedirects = 5): Promise<string> {
    let currentUrl = url;
    let count = 0;

    try {
        while (count < maxRedirects) {
            const response = await fetch(currentUrl, {
                method: 'HEAD',
                redirect: 'manual',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.get('location');
                if (location) {
                    // Handle relative URLs
                    currentUrl = new URL(location, currentUrl).toString();
                    count++;
                    continue;
                }
            }
            break;
        }
    } catch (e) {
        console.error(`Error unshortening ${url}:`, e);
        // If it fails, just return what we have
    }

    return currentUrl;
}

export function clean(url: string): string {
    try {
        const parsed = new URL(url);

        // 0. Parse host
        const host = parsed.hostname;

        // 1. Check for domain-specific rules
        let appliedRule = false;

        // We need to match domain (e.g. www.bilibili.com should match bilibili.com)
        // Simple includes check or endsWith
        for (const [domain, rule] of Object.entries(config.domainRules)) {
            if (host.includes(domain)) {
                appliedRule = true;
                if (rule.mode === 'whitelist') {
                    // Whitelist: Remove everything NOT in params
                    const keep = new Set(rule.params);
                    const toDelete: string[] = [];
                    parsed.searchParams.forEach((_, key) => {
                        if (!keep.has(key)) toDelete.push(key);
                    });
                    toDelete.forEach(k => parsed.searchParams.delete(k));
                } else {
                    // Blacklist: Apply Global Blacklist FIRST, then Domain Blocklist.

                    // Apply Global
                    config.globalBlacklist.forEach(p => parsed.searchParams.delete(p));

                    // Apply Domain Specific
                    rule.params.forEach(p => parsed.searchParams.delete(p));
                }
                break;
            }
        }

        // 2. Fallback: If no rule applied, just use global blacklist
        if (!appliedRule) {
            config.globalBlacklist.forEach(param => parsed.searchParams.delete(param));
        }

        return parsed.toString();
    } catch (e) {
        return url;
    }
}

export function extractUrls(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
}
