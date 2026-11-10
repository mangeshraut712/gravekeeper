/**
 * POST /api/verify
 *
 * Checks an exported receipt file. The same check runs in the browser via
 * verifyReceiptExport; this route is the curl-friendly copy.
 */

import { NextRequest } from 'next/server';
import { verifyReceiptExport } from '@/lib/receipts/export';

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { valid: false, reason: 'parse', error: 'Request body must be valid JSON.', code: 'PARSE_ERROR' },
      { status: 400 },
    );
  }

  const result = await verifyReceiptExport(body);
  if (result.reason === 'parse') {
    return Response.json(
      {
        ...result,
        error: 'Body is not a Gravekeeper receipt export.',
        code: 'PARSE_ERROR',
      },
      { status: 400 },
    );
  }

  return Response.json(result, { status: 200 });
}
