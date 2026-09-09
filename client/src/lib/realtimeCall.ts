import { getStoredToken } from './authStorage';
import { API_BASE_URL } from './api';

export async function postRealtimeCallOffer(sessionId: string, sdp: string): Promise<string> {
  const token = getStoredToken();
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/realtime/call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/sdp',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: sdp,
  });

  const text = await response.text();
  if (!response.ok) {
    const err = new Error('realtime-call-failed') as Error & { status?: number };
    err.status = response.status;
    throw err;
  }
  return text;
}
