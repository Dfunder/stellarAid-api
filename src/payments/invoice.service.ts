import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';

export interface InvoiceData {
  invoiceNumber: string;
  issuedAt: Date;
  dueAt: Date;
  clientName: string;
  clientEmail: string;
  artistName: string;
  commissionTitle: string;
  commissionId: string;
  paymentId: string;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  assetCode: string;
  txHash: string | null;
  status: string;
}

let invoiceCounter = 1;

function generateInvoiceNumber(): string {
  const prefix = 'INV';
  const year = new Date().getFullYear();
  const seq = String(invoiceCounter++).padStart(6, '0');
  return `${prefix}-${year}-${seq}`;
}

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Generate invoice data for a payment (#640). */
  async generateInvoice(paymentId: string): Promise<InvoiceData> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        commission: {
          include: {
            client: true,
            artist: { include: { user: true } },
          },
        },
      },
    });

    if (!payment) throw new NotFoundException(`Payment ${paymentId} not found`);

    const gross = Number(payment.amountUsdc);
    const fee = Number(payment.platformFeeUsdc);

    const invoice: InvoiceData = {
      invoiceNumber: generateInvoiceNumber(),
      issuedAt: new Date(),
      dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      clientName: payment.commission.client.name,
      clientEmail: payment.commission.client.email,
      artistName: payment.commission.artist.user?.name ?? 'Artist',
      commissionTitle: payment.commission.title,
      commissionId: payment.commissionId,
      paymentId: payment.id,
      grossAmount: gross,
      platformFee: fee,
      netAmount: gross - fee,
      assetCode: payment.assetCode,
      txHash: payment.txHash,
      status: payment.status,
    };

    this.logger.log(`Invoice generated — invoiceNumber=${invoice.invoiceNumber} paymentId=${paymentId}`);

    // Notify client
    await this.prisma.notification.create({
      data: {
        userId: payment.commission.clientId,
        type: 'INVOICE_GENERATED',
        title: `Invoice ${invoice.invoiceNumber}`,
        message: `Invoice for commission "${payment.commission.title}" has been generated.`,
        metadata: { invoiceNumber: invoice.invoiceNumber, paymentId },
      },
    });

    return invoice;
  }

  /** Render invoice as plain-text (exportable as PDF client-side) (#640). */
  formatInvoiceText(invoice: InvoiceData): string {
    return [
      `INVOICE — ${invoice.invoiceNumber}`,
      `Issued: ${invoice.issuedAt.toISOString().split('T')[0]}`,
      ``,
      `FROM: ${invoice.artistName}`,
      `TO:   ${invoice.clientName} <${invoice.clientEmail}>`,
      ``,
      `Commission: ${invoice.commissionTitle}`,
      `Commission ID: ${invoice.commissionId}`,
      ``,
      `Gross amount:   ${invoice.grossAmount} ${invoice.assetCode}`,
      `Platform fee:   ${invoice.platformFee} ${invoice.assetCode}`,
      `Net to artist:  ${invoice.netAmount} ${invoice.assetCode}`,
      ``,
      `Payment status: ${invoice.status}`,
      invoice.txHash ? `Tx hash: ${invoice.txHash}` : '',
    ]
      .filter((line) => line !== undefined)
      .join('\n');
  }
}
