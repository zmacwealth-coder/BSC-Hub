import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';
import PDFDocument from 'pdfkit';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const paymentId = searchParams.get('paymentId');

  if (!paymentId) {
    return NextResponse.json({ error: 'Missing paymentId parameter' }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    // 1. Fetch payment record
    const { data: payment, error: payErr } = await supabase
      .from('payments')
      .select('*, students(full_name, id, class_id, classes(name)), users(full_name)')
      .eq('id', paymentId)
      .single();

    if (payErr || !payment) {
      return NextResponse.json({ error: 'Payment record not found' }, { status: 404 });
    }

    const studentName = (payment.students as any)?.full_name || 'N/A';
    const studentId = (payment.students as any)?.id || 'N/A';
    const className = (payment.students as any)?.classes?.name || 'N/A';
    const recordedBy = (payment.users as any)?.full_name || 'System';

    // 2. Generate PDF in memory
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A5', layout: 'landscape' }); // Landscape A5 for neat slip
      const chunks: Buffer[] = [];
      
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Brand colors
      const primaryColor = '#ec4899'; // Pink
      const secondaryColor = '#0284c7'; // Blue
      const textColor = '#1e293b'; // Slate-800

      // Header block
      doc.rect(0, 0, 595.28, 70).fill(secondaryColor);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16);
      doc.text('BRIGHT SUCCESS COLLEGE', 30, 20);
      doc.font('Helvetica-Oblique').fontSize(8);
      doc.text('Excellence in Knowledge and Character', 30, 38);
      doc.font('Helvetica').fontSize(8);
      doc.text('Gaa Baba Eji, Agbale, Ede, Osun State.', 30, 48);

      // Receipt Title
      doc.fillColor(textColor).font('Helvetica-Bold').fontSize(12);
      doc.text('OFFICIAL BURSARY RECEIPT', 30, 90);
      doc.strokeColor(primaryColor).lineWidth(1).moveTo(30, 105).lineTo(565.28, 105).stroke();

      // Details Grid
      doc.font('Helvetica-Bold').fontSize(8);
      doc.text('Receipt No:', 30, 120);
      doc.text('Payment Date:', 30, 135);
      doc.text('Category:', 30, 150);

      doc.font('Helvetica');
      doc.text(payment.receipt_number, 100, 120);
      doc.text(new Date(payment.payment_date).toLocaleString(), 100, 135);
      doc.text(payment.category, 100, 150);

      doc.font('Helvetica-Bold');
      doc.text('Student Name:', 300, 120);
      doc.text('Student ID:', 300, 135);
      doc.text('Class:', 300, 150);

      doc.font('Helvetica');
      doc.text(studentName, 380, 120);
      doc.text(studentId, 380, 135);
      doc.text(className, 380, 150);

      // Financial Details Table
      const tableTop = 180;
      doc.rect(30, tableTop, 535.28, 20).fill('#f1f5f9');
      
      doc.fillColor(textColor).font('Helvetica-Bold').fontSize(8);
      doc.text('Description', 40, tableTop + 6);
      doc.text('Amount Expected', 250, tableTop + 6, { align: 'right', width: 90 });
      doc.text('Amount Paid', 350, tableTop + 6, { align: 'right', width: 90 });
      doc.text('Remaining Balance', 460, tableTop + 6, { align: 'right', width: 95 });

      const rowY = tableTop + 20;
      doc.font('Helvetica').fontSize(8);
      doc.text(`${payment.category} Fees Payment`, 40, rowY + 6);
      doc.text(`N${payment.total_expected.toFixed(2)}`, 250, rowY + 6, { align: 'right', width: 90 });
      doc.font('Helvetica-Bold');
      doc.text(`N${payment.amount_paid.toFixed(2)}`, 350, rowY + 6, { align: 'right', width: 90 });
      doc.text(`N${payment.balance.toFixed(2)}`, 460, rowY + 6, { align: 'right', width: 95 });

      // Borders
      doc.strokeColor('#cbd5e1').lineWidth(0.5)
         .moveTo(30, rowY).lineTo(565.28, rowY)
         .moveTo(30, rowY + 20).lineTo(565.28, rowY + 20)
         .stroke();

      // Signatures / Footer
      doc.fillColor('#64748b').font('Helvetica').fontSize(7);
      doc.text(`Recorded By: ${recordedBy}`, 30, 250);
      doc.text('Thank you for your payment. Please keep this receipt for record purposes.', 30, 262);

      doc.fillColor(textColor).font('Helvetica-Bold').fontSize(8);
      doc.text('Bursar Signature & Stamp', 420, 245, { align: 'center', width: 130 });
      doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(420, 240).lineTo(550, 240).stroke();

      doc.end();
    });

    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Receipt_${payment.receipt_number}.pdf"`
      }
    });

  } catch (error: any) {
    console.error('PDF Receipt Generation failed:', error);
    return NextResponse.json({ error: 'Failed to generate PDF: ' + error.message }, { status: 500 });
  }
}
