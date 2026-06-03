"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.probeWindowUsage = probeWindowUsage;
exports.maxUsagePct = maxUsagePct;
exports.isExpensiveModel = isExpensiveModel;
const client_1 = require("../src/cdp/client");
const composer_panel_1 = require("../src/cdp/composer-panel");
const live_cdp_1 = require("../src/cdp/live-cdp");
const live_page_1 = require("../src/cdp/live-page");
async function probeWindowUsage(cdp = live_cdp_1.liveCdp) {
    if (!(await cdp.isAvailable()))
        return [];
    const pages = (await cdp.listTargets()).filter((t) => t.type === 'page' && /Cursor/i.test(t.title || '') && !/Settings/i.test(t.title || ''));
    const out = [];
    for (const page of pages) {
        if (!page.webSocketDebuggerUrl)
            continue;
        try {
            const raw = await (0, live_page_1.evalOnPage)(page, composer_panel_1.PROBE_COMPOSER_PANEL_JS, true);
            const p = (0, composer_panel_1.parseComposerPanelProbe)(raw);
            if (!p?.ok)
                continue;
            out.push({
                windowTitle: page.title || '',
                model: p.model.label,
                usagePct: p.context.usagePct,
                usageVisible: p.context.usageVisible,
                composerId: p.composerId,
            });
        }
        catch {
            /* skip */
        }
    }
    return out;
}
function maxUsagePct(windows) {
    const vals = windows.map((w) => w.usagePct).filter((x) => x != null);
    return vals.length ? Math.max(...vals) : null;
}
function isExpensiveModel(label) {
    return /sonnet|opus|thinking|o3|gpt-5/i.test(label) && !/fast|medium/i.test(label);
}
async function main() {
    const base = (0, client_1.cdpBaseUrl)();
    if (!(await (0, client_1.checkCdpAvailable)(base))) {
        console.error('CDP unavailable');
        process.exit(1);
    }
    const windows = await probeWindowUsage();
    const max = maxUsagePct(windows);
    console.log(JSON.stringify({ at: Date.now(), maxUsagePct: max, windows }, null, 2));
}
if (require.main === module) {
    main().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
