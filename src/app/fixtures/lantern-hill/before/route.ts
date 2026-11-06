import { LANTERN_HILL_HTML } from '@/lib/restore/fixture';
import { htmlResponse } from '@/lib/restore/serve';

export function GET(): Response {
  return htmlResponse(LANTERN_HILL_HTML, "'none'");
}
