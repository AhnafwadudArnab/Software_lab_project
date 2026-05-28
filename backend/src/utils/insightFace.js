const INSIGHTFACE_API_URL = process.env.INSIGHTFACE_API_URL || 'http://localhost:7000/compare';
const INSIGHTFACE_TOKEN =
  process.env.INSIGHTFACE_TOKEN ||
  process.env.VITE_INSIGHTFACE_TOKEN ||
  '1KioG8FWMS2R4sVGRR4uKDHHB3LnRzL76b';

function toBase64(buffer) {
  return Buffer.from(buffer).toString('base64');
}

export function isInsightFaceConfigured() {
  return Boolean(INSIGHTFACE_API_URL && INSIGHTFACE_TOKEN);
}

export async function compareFacesWithInsightFace({
  queryBuffer,
  queryMimeType,
  referenceBuffer,
  referenceMimeType,
}) {
  if (!isInsightFaceConfigured()) return null;
  if (!queryBuffer || !referenceBuffer) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(INSIGHTFACE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        token: INSIGHTFACE_TOKEN,
        queryImage: {
          data: toBase64(queryBuffer),
          mimeType: queryMimeType || 'image/jpeg',
        },
        referenceImage: {
          data: toBase64(referenceBuffer),
          mimeType: referenceMimeType || 'image/jpeg',
        },
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();
    const rawScore =
      data?.score ??
      data?.similarity ??
      data?.match_score ??
      data?.result?.score ??
      data?.result?.similarity ??
      data?.data?.score ??
      data?.data?.similarity;

    const score = Number(rawScore);
    if (!Number.isFinite(score)) return null;

    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      raw: data,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
