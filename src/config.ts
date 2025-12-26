export type CleaningRule = {
    mode: 'blacklist' | 'whitelist';
    params: string[];
};

export type CleanerConfig = {
    globalBlacklist: string[];
    domainRules: Record<string, CleaningRule>;
};

export const config: CleanerConfig = {
    globalBlacklist: [
        // Standard UTM
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_cid', 'utm_reader', 'utm_referrer', 'utm_name', 'utm_social', 'utm_social-type',
        // Ad Click IDs
        'fbclid', 'gclid', 'msclkid', 'dclid', 'twclid', 'igshid',
        // Common Share Params
        'share_token', 'share_id', 'share_link_id', 'sharer_shareid', 'share_app_id',
        // Platform Specific (Generic)
        'si', 'feature', 'pp', 'wt_z', // Youtube
        'spm', 'scm', // Ali/Taobao
        'ref', 'ref_src', 'source',
        // HubSpot / MailChimp
        '_hsenc', '_hsmi', 'mc_cid', 'mc_eid'
    ],
    domainRules: {
        'bilibili.com': {
            mode: 'whitelist',
            params: ['p', 't', 'bvid', 'aid', 'cid'] // Only keep video ID, page, timestamp
        },
        'xiaohongshu.com': {
            mode: 'whitelist',
            params: ['xsec_token']
        },
        'douyin.com': {
            mode: 'blacklist',
            params: ['share_token', 'smid', '_d', 'tt_from', 'u_code', 'iid', 'did']
        },
        'tiktok.com': {
            mode: 'blacklist',
            params: ['share_token', 'smid', '_d', 'tt_from', 'u_code', 'iid', 'did']
        }
    }
};
