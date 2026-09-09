import { jsPDF } from 'jspdf';
import reshaper from 'arabic-persian-reshaper';

export interface OsceReportLabels {
  certificateTitle: string;
  officialReport: string;
  totalScore: string;
  station: string;
  patient: string;
  date: string;
  sessionId: string;
  scoreCommunication: string;
  scoreHistory: string;
  scoreClinicalReason: string;
  scoreOrganization: string;
  scoreClosing: string;
  strengths: string;
  weaknesses: string;
  missedQuestions: string;
  clinicalErrors: string;
  recommendations: string;
  idealApproach: string;
  fullReport: string;
  certifiedSeal: string;
  platformName: string;
}

export interface OsceReportData {
  sessionId: string;
  stationTitle: string;
  patientName: string;
  result: Record<string, unknown>;
  isAr: boolean;
  labels: OsceReportLabels;
}

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;
const LINE_H = 5.2;

let cairoRegularBase64: string | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function loadFontBase64(): Promise<string> {
  if (cairoRegularBase64) return cairoRegularBase64;
  const res = await fetch('/fonts/Cairo-Regular.ttf');
  if (!res.ok) throw new Error('font-load-failed');
  cairoRegularBase64 = arrayBufferToBase64(await res.arrayBuffer());
  return cairoRegularBase64;
}

async function loadReportLogo(): Promise<string | null> {
  for (const path of ['/report-logo.png', '/synoza-wordmark.png', '/synoza-logo.png', '/synoza-icon.png']) {
    try {
      const res = await fetch(path);
      if (!res.ok) continue;
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('logo-read-failed'));
        reader.readAsDataURL(blob);
      });
    } catch {
      /* try next */
    }
  }
  return null;
}

type PreparedReportLogo = {
  dataUrl: string;
  widthMm: number;
  heightMm: number;
};

function isLogoPixelEmpty(r: number, g: number, b: number, a: number): boolean {
  if (a <= 12) return true;
  if (r > 245 && g > 245 && b > 245) return true;
  if (r < 18 && g < 18 && b < 18) return true;
  return false;
}

async function trimLogoDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);

      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let top = height;
      let bottom = 0;
      let left = width;
      let right = 0;

      for (let py = 0; py < height; py += 1) {
        for (let px = 0; px < width; px += 1) {
          const i = (py * width + px) * 4;
          if (!isLogoPixelEmpty(data[i], data[i + 1], data[i + 2], data[i + 3])) {
            top = Math.min(top, py);
            bottom = Math.max(bottom, py);
            left = Math.min(left, px);
            right = Math.max(right, px);
          }
        }
      }

      if (top >= bottom || left >= right) {
        resolve(dataUrl);
        return;
      }

      const pad = Math.max(2, Math.round(Math.min(width, height) * 0.01));
      const cropX = Math.max(0, left - pad);
      const cropY = Math.max(0, top - pad);
      const cropRight = Math.min(width, right + pad + 1);
      const cropBottom = Math.min(height, bottom + pad + 1);
      const cropW = cropRight - cropX;
      const cropH = cropBottom - cropY;

      const out = document.createElement('canvas');
      out.width = cropW;
      out.height = cropH;
      out.getContext('2d')!.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      resolve(out.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function loadImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('logo-size-failed'));
    img.src = dataUrl;
  });
}

async function prepareReportLogo(dataUrl: string | null): Promise<PreparedReportLogo | null> {
  if (!dataUrl) return null;
  try {
    const trimmed = await trimLogoDataUrl(dataUrl);
    const { width, height } = await loadImageSize(trimmed);
    if (!width || !height) return null;

    const aspect = width / height;
    const targetH = 12;
    let logoW = targetH * aspect;
    let logoH = targetH;
    const maxW = 48;
    if (logoW > maxW) {
      logoW = maxW;
      logoH = logoW / aspect;
    }

    return { dataUrl: trimmed, widthMm: logoW, heightMm: logoH };
  } catch {
    return null;
  }
}

function prepareText(text: string, isAr: boolean): string {
  if (!text) return '';
  if (!isAr) return text;
  return reshaper.ArabicShaper.convertArabic(text);
}

function scoreColor(score: number): [number, number, number] {
  if (score >= 70) return [5, 150, 105];
  if (score >= 50) return [217, 119, 6];
  return [220, 38, 38];
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^[-*]\s+/gm, '• ')
    .trim();
}

function setupDoc(fontBase64: string, isAr: boolean): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  doc.addFileToVFS('Cairo-Regular.ttf', fontBase64);
  doc.addFont('Cairo-Regular.ttf', 'Cairo', 'normal');
  doc.addFont('Cairo-Regular.ttf', 'Cairo', 'bold');
  doc.setFont('Cairo', 'normal');
  if (isAr) doc.setR2L(true);
  return doc;
}

function textX(isAr: boolean): number {
  return isAr ? PAGE_W - MARGIN : MARGIN;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - MARGIN) {
    doc.addPage();
    return MARGIN + 4;
  }
  return y;
}

function drawPageBackground(doc: jsPDF) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
}

function drawHeader(
  doc: jsPDF,
  labels: OsceReportLabels,
  logo: PreparedReportLogo | null,
  isAr: boolean,
): number {
  drawPageBackground(doc);
  const y = MARGIN + 2;
  const x = textX(isAr);

  // synoza logotype in deep teal / slate
  doc.setFont('Cairo', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(13, 148, 136); // Teal #0d9488
  doc.text('synoza', x, y + 4, { align: isAr ? 'right' : 'left' });

  // Subtitle
  doc.setFont('Cairo', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('OSCE Clinical Assessment & Simulation Platform', x, y + 9.5, { align: isAr ? 'right' : 'left' });

  // Official Evaluation Report on the right
  const rightX = isAr ? MARGIN : PAGE_W - MARGIN;
  doc.setFont('Cairo', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(prepareText(labels.officialReport || 'Official Evaluation Report', isAr), rightX, y + 3, {
    align: isAr ? 'left' : 'right',
  });

  // Teal accent line under Official Evaluation Report
  const lineW = 34;
  const lineStartX = isAr ? MARGIN : PAGE_W - MARGIN - lineW;
  doc.setDrawColor(13, 148, 136);
  doc.setLineWidth(1.2);
  doc.line(lineStartX, y + 6, lineStartX + lineW, y + 6);

  const dividerY = y + 13;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, dividerY, PAGE_W - MARGIN, dividerY);
  return dividerY + 5;
}

function drawMeta(
  doc: jsPDF,
  data: OsceReportData,
  dateStr: string,
  y: number,
  isAr: boolean,
): number {
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(MARGIN, y, CONTENT_W, 23, 3, 3, 'FD');

  const colW = (CONTENT_W - 32) / 2;

  // Station
  doc.setFont('Cairo', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('STATION', MARGIN + 5, y + 5);
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(data.stationTitle.slice(0, 36), MARGIN + 5, y + 9.5);

  // Date
  doc.setFont('Cairo', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('DATE & TIME', MARGIN + 5, y + 15.5);
  doc.setFont('Cairo', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(dateStr, MARGIN + 5, y + 19.5);

  // Divider between col 1 & 2
  doc.setDrawColor(226, 232, 240);
  doc.line(MARGIN + colW + 4, y + 3, MARGIN + colW + 4, y + 20);

  // Patient
  doc.setFont('Cairo', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('PATIENT ENCOUNTER', MARGIN + colW + 8, y + 5);
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(data.patientName.slice(0, 32), MARGIN + colW + 8, y + 9.5);

  // Session ID
  doc.setFont('Cairo', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('SESSION ID', MARGIN + colW + 8, y + 15.5);
  doc.setFont('Cairo', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(data.sessionId.slice(0, 14), MARGIN + colW + 8, y + 19.5);

  // Small Verified Badge on Right
  const sealCx = PAGE_W - MARGIN - 14;
  const sealCy = y + 11.5;
  doc.setFillColor(240, 253, 250);
  doc.setDrawColor(13, 148, 136);
  doc.setLineWidth(0.6);
  doc.circle(sealCx, sealCy, 8.5, 'FD');

  doc.setFont('Cairo', 'bold');
  doc.setFontSize(5);
  doc.setTextColor(13, 148, 136);
  doc.text('SYNOZA', sealCx, sealCy - 2.2, { align: 'center' });
  doc.setFontSize(4);
  doc.text('CERTIFIED', sealCx, sealCy + 0.6, { align: 'center' });
  doc.setFontSize(4.5);
  doc.text('OSCE', sealCx, sealCy + 3.4, { align: 'center' });

  return y + 27;
}

function drawScores(doc: jsPDF, data: OsceReportData, y: number, isAr: boolean): number {
  const total = Number(data.result.totalScore ?? 0);
  const scores = [
    ['Communication', Number(data.result.communicationScore ?? 0)],
    ['History Taking', Number(data.result.historyTakingScore ?? 0)],
    ['Clinical Reasoning', Number(data.result.clinicalReasonScore ?? 0)],
    ['Organization', Number(data.result.organizationScore ?? 0)],
    ['Closing', Number(data.result.closingScore ?? 0)],
  ] as const;

  doc.setFillColor(240, 253, 250); // Light teal tint
  doc.setDrawColor(204, 251, 241);
  doc.setLineWidth(0.5);
  doc.roundedRect(MARGIN, y, CONTENT_W, 25, 3, 3, 'FD');

  // Total Score on Left
  doc.setFont('Cairo', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(13, 148, 136);
  doc.text('OVERALL SCORE', MARGIN + 6, y + 7);

  doc.setFont('Cairo', 'bold');
  doc.setFontSize(20);
  const [tr, tg, tb] = scoreColor(total);
  doc.setTextColor(tr, tg, tb);
  doc.text(`${total}%`, MARGIN + 6, y + 18);

  // Vertical divider
  doc.setDrawColor(204, 251, 241);
  doc.line(MARGIN + 36, y + 4, MARGIN + 36, y + 21);

  // 5 Category columns
  const gridStartX = MARGIN + 40;
  const gridW = CONTENT_W - 44;
  const colW = gridW / 5;

  scores.forEach(([label, value], i) => {
    const cx = gridStartX + i * colW + colW / 2;

    doc.setFont('Cairo', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(71, 85, 105);
    const labelLines = doc.splitTextToSize(label, colW - 2) as string[];
    doc.text(labelLines.slice(0, 2), cx, y + 7.5, { align: 'center' });

    doc.setFont('Cairo', 'bold');
    doc.setFontSize(9.5);
    const [r, g, b] = scoreColor(value);
    doc.setTextColor(r, g, b);
    doc.text(`${value}%`, cx, y + 18, { align: 'center' });
  });

  return y + 29;
}

function drawSection(
  doc: jsPDF,
  title: string,
  body: string,
  y: number,
  isAr: boolean,
): number {
  if (!body?.trim()) return y;

  const prepared = prepareText(stripMarkdown(body), isAr);
  const bodyLines = doc.splitTextToSize(prepared, CONTENT_W - 42) as string[];
  const minBoxH = 14;
  const calculatedH = 8 + bodyLines.length * 4.2;
  const boxH = Math.max(minBoxH, calculatedH);

  y = ensureSpace(doc, y, boxH + 4);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 2.5, 2.5, 'FD');

  // Title on Left
  doc.setFont('Cairo', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(13, 148, 136); // Teal header
  const titleLines = doc.splitTextToSize(title, 28) as string[];
  doc.text(titleLines.slice(0, 2), MARGIN + 5, y + 6);

  // Vertical divider between title and content
  doc.setDrawColor(241, 245, 249);
  doc.setLineWidth(0.4);
  doc.line(MARGIN + 34, y + 3, MARGIN + 34, y + boxH - 3);

  // Content text
  doc.setFont('Cairo', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  let lineY = y + 6;
  for (const line of bodyLines) {
    doc.text(line, MARGIN + 38, lineY, { maxWidth: CONTENT_W - 42 });
    lineY += 4.2;
  }

  return y + boxH + 3;
}

function parseFullReportParagraphs(
  data: OsceReportData,
): Array<{ subtitle: string; content: string }> {
  const fullReportText = String(data.result.fullReport ?? '').trim();
  const summaryParagraphs: Array<{ subtitle: string; content: string }> = [];

  if (fullReportText) {
    const raw = stripMarkdown(fullReportText);
    const parts = raw.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      for (const part of parts) {
        const lines = part.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length === 1 && lines[0].endsWith(':')) {
          continue;
        }
        if (lines[0].includes(':') && lines[0].length < 50) {
          const colonIdx = lines[0].indexOf(':');
          const sub = lines[0].slice(0, colonIdx + 1).trim();
          const rest = lines[0].slice(colonIdx + 1).trim() + (lines.slice(1).length ? '\n' + lines.slice(1).join('\n') : '');
          summaryParagraphs.push({ subtitle: sub, content: rest });
        } else {
          summaryParagraphs.push({ subtitle: '', content: part });
        }
      }
    }
  }

  if (summaryParagraphs.length === 0) {
    const overview = String(data.result.recommendations ?? data.result.idealApproach ?? '').slice(0, 300);
    const communication = String(data.result.strengths ?? '').slice(0, 250);
    const historyTaking = String(data.result.weaknesses ?? '').slice(0, 250);
    const clinicalExam = String(data.result.missedQuestions ?? '').slice(0, 250);
    const reasoning = String(data.result.clinicalErrors ?? '').slice(0, 250);

    summaryParagraphs.push({
      subtitle: 'Overview:',
      content:
        overview ||
        'The candidate completed the interactive clinical OSCE session covering systematic history taking and physical examination findings.',
    });
    if (communication) {
      summaryParagraphs.push({ subtitle: 'Communication and Professionalism:', content: `• ${communication}` });
    }
    if (historyTaking) {
      summaryParagraphs.push({ subtitle: 'History Taking:', content: `• ${historyTaking}` });
    }
    if (clinicalExam) {
      summaryParagraphs.push({ subtitle: 'Clinical Examination:', content: `• ${clinicalExam}` });
    }
    if (reasoning) {
      summaryParagraphs.push({ subtitle: 'Clinical Reasoning and Management:', content: `• ${reasoning}` });
    }
    summaryParagraphs.push({
      subtitle: 'Final Comment:',
      content:
        'Structured systematic review and active engagement with examiner prompts are essential to achieve full clinical competence in OSCE settings.',
    });
  }

  return summaryParagraphs;
}

/** Draws the clean "Full AI Report" card in PDF. */
function drawFullAiReportCard(
  doc: jsPDF,
  data: OsceReportData,
  y: number,
  isAr: boolean,
): number {
  const summaryParagraphs = parseFullReportParagraphs(data);

  let totalLinesCount = 4;
  for (const p of summaryParagraphs) {
    if (p.subtitle) totalLinesCount += 1;
    const lines = doc.splitTextToSize(p.content, CONTENT_W - 12) as string[];
    totalLinesCount += lines.length + 1;
  }

  const boxH = Math.max(35, totalLinesCount * 4 + 14);
  y = ensureSpace(doc, y, Math.min(boxH, 80));

  // Outer Box with clean light gray/teal border
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(204, 251, 241);
  doc.setLineWidth(0.6);
  doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 3, 3, 'FD');

  // Top Card Header: "Full AI Report" in Teal
  doc.setFont('Cairo', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(13, 148, 136); // Teal
  doc.text(data.labels.fullReport || 'Full AI Report', MARGIN + 6, y + 6);

  // Dividing line under header
  doc.setDrawColor(204, 251, 241);
  doc.setLineWidth(0.4);
  doc.line(MARGIN + 6, y + 8.5, MARGIN + CONTENT_W - 6, y + 8.5);

  let curY = y + 14;
  for (const item of summaryParagraphs) {
    if (item.subtitle) {
      doc.setFont('Cairo', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85);
      doc.text(prepareText(item.subtitle, isAr), MARGIN + 6, curY);
      curY += 4;
    }

    doc.setFont('Cairo', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105);
    const contentLines = doc.splitTextToSize(prepareText(item.content, isAr), CONTENT_W - 12) as string[];
    for (const l of contentLines) {
      doc.text(l, MARGIN + 6, curY);
      curY += 3.8;
    }
    curY += 2;
  }

  return curY + 4;
}

export async function downloadOsceReportPdf(data: OsceReportData): Promise<void> {
  const [fontBase64, logoDataUrl] = await Promise.all([loadFontBase64(), loadReportLogo()]);
  const logo = await prepareReportLogo(logoDataUrl);
  const { result, labels, isAr } = data;
  const doc = setupDoc(fontBase64, isAr);

  const dateStr = new Date().toLocaleString(isAr ? 'ar-EG' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  let y = drawHeader(doc, labels, logo, isAr);
  y = drawMeta(doc, data, dateStr, y, isAr);
  y = drawScores(doc, data, y, isAr);

  const sections = [
    ['STRENGTHS', String(result.strengths ?? '')],
    ['WEAKNESSES', String(result.weaknesses ?? '')],
    ['MISSED QUESTIONS', String(result.missedQuestions ?? '')],
    ['CLINICAL ERRORS', String(result.clinicalErrors ?? '')],
    ['RECOMMENDATIONS', String(result.recommendations ?? '')],
    ['IDEAL APPROACH', String(result.idealApproach ?? '')],
  ] as const;

  for (const [title, body] of sections) {
    y = drawSection(doc, title, body, y, isAr);
  }

  // Draw the Full AI Report Card as shown in the design
  drawFullAiReportCard(doc, data, y + 2, isAr);

  // Note: Report footer is removed from download as requested by user

  doc.save(`synoza-report-${data.sessionId.slice(0, 8)}.pdf`);
}
