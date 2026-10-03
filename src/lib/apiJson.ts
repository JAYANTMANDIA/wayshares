export async function readApiJson<T = Record<string, unknown>>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      response.status === 404
        ? 'The backend API is not running on this host. Redeploy with the Vercel /api function and server environment variables.'
        : `The server returned a non-JSON response (${response.status}).`
    );
  }
}
