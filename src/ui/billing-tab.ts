import type { BillingView } from './views/render-billing';
import { renderBillingHtml } from './views/render-billing';

export async function loadBillingPanelHtml(
  fetchFn: (url: string) => Promise<Response> = fetch
): Promise<string> {
  try {
    const response = await fetchFn('/api/billing');
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      return renderBillingHtml(null, body.error || response.statusText);
    }
    return renderBillingHtml((await response.json()) as BillingView);
  } catch (error) {
    return renderBillingHtml(
      null,
      error instanceof Error ? error.message : String(error)
    );
  }
}
