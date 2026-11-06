export interface RazorpayFailure {
  error?: {description?: string; reason?: string; code?: string; source?: string; step?: string};
}

export function checkoutMethods() { return {}; }

export function checkoutFailure(response: RazorpayFailure | undefined) {
  const detail = response?.error?.description?.trim().slice(0, 240)
    || 'Razorpay could not complete this payment.';
  return `${detail} Try another payment method, or contact your bank if the decline continues. Check payment status before paying again.`;
}
