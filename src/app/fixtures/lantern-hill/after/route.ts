import { LANTERN_HILL_HTML } from '@/lib/restore/fixture';
import { restoreDeadHtml } from '@/lib/restore/html';
import { htmlResponse } from '@/lib/restore/serve';

export function GET(): Response {
  const restored = restoreDeadHtml(LANTERN_HILL_HTML, { fixtureLabel: 'Lantern Hill' });
  return htmlResponse(restored.html, "'self'");
}
