import api from './api';

export interface HistorySheetMetadata {
  fileName: string;
  mimeType: string;
  fileSize: number;
  updatedAt: string;
}

export async function downloadHistorySheet(caseId: string, fileName: string): Promise<void> {
  try {
    const response = await api.get<Blob>(`/cases/${encodeURIComponent(caseId)}/history-sheet`, {
      responseType: 'blob',
      timeout: 60_000,
    });
    const objectUrl = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
  } catch (error) {
    const responseData = (error as { response?: { data?: unknown } })?.response?.data;
    if (responseData instanceof Blob) {
      try {
        const payload = JSON.parse(await responseData.text()) as { error?: string };
        if (payload.error) throw new Error(payload.error);
      } catch (parseError) {
        if (!(parseError instanceof SyntaxError)) throw parseError;
      }
    }
    throw new Error('Could not download the History Sheet. Please try again.');
  }
}
