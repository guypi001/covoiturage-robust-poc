type ReceiptPdfPayload = {
  bookingId: string;
  passengerName: string;
  passengerEmail?: string | null;
  originCity?: string;
  destinationCity?: string;
  departureAt?: string;
  seats?: number;
  amount?: number;
  paymentMethod?: string;
  issuedAt?: string;
};

const escapePdfText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

export const buildReceiptPdfBuffer = (payload: ReceiptPdfPayload) => {
  const issuedLabel = payload.issuedAt
    ? new Date(payload.issuedAt).toLocaleString('fr-FR')
    : new Date().toLocaleString('fr-FR');
  const departureLabel = payload.departureAt
    ? new Date(payload.departureAt).toLocaleString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'bientot';
  const amountLabel = payload.amount ? `${payload.amount.toLocaleString?.() ?? payload.amount} XOF` : '0 XOF';

  const lines = [
    'KariGo - Recu de paiement',
    `Reference: ${payload.bookingId}`,
    `Emis le: ${issuedLabel}`,
    '',
    `Client: ${payload.passengerName}`,
    `Email: ${payload.passengerEmail || 'Non fourni'}`,
    `Trajet: ${payload.originCity ?? '?'} -> ${payload.destinationCity ?? '?'}`,
    `Depart: ${departureLabel}`,
    `Places: ${payload.seats ?? 1}`,
    `Moyen: ${payload.paymentMethod ?? 'Paiement'}`,
    `Montant: ${amountLabel}`,
  ];

  const content = [
    'BT',
    '/F1 12 Tf',
    '50 800 Td',
    '16 TL',
    ...lines.map((line) => `(${escapePdfText(line)}) Tj T*`),
    'ET',
  ].join('\n');

  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objects.push(
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
  );
  objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  objects.forEach((obj, idx) => {
    offsets.push(pdf.length);
    pdf += `${idx + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'binary');
};
