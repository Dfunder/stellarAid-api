// Fix for #471: refund a commission's payment to the client, marking
// the record REFUNDED and preparing the client notification payload.
export interface RefundablePayment {
  id: number;
  status: 'PENDING' | 'ESCROWED' | 'REFUNDED';
  clientId: string;
  amount: number;
}

export interface EscrowClient {
  refund_customer(paymentId: number, amount: number): { txHash: string };
}

export function refundPayment(payment: RefundablePayment, escrow: EscrowClient) {
  if (payment.status !== 'ESCROWED') {
    throw new Error('Only escrowed payments can be refunded');
  }
  const { txHash } = escrow.refund_customer(payment.id, payment.amount);
  const updated: RefundablePayment = { ...payment, status: 'REFUNDED' };
  const notification = {
    clientId: payment.clientId,
    paymentId: payment.id,
    amount: payment.amount,
    txHash,
  };
  return { updated, notification };
}
