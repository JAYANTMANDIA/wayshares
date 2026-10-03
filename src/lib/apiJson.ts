export async function readApiJson<T = Record<string, unknown>>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `The server API is unavailable (${response.status}). Open /api/health on this site; it must return JSON, not an HTML error page.`
    );
  }
}
