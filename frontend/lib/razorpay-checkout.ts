export interface RazorpayFailure {
  error?: {description?: string; reason?: string; code?: string; source?: string; step?: string};
}

// UPI QR/intent cannot be paid by real bank apps when using test keys.
// Keep live checkout on the merchant's normal Razorpay configuration.
export function checkoutMethods(mode: string) {
  if (mode !== 'test') return {};
  return {config: {display: {
    blocks: {test_methods: {name: 'Test card or mock bank', instruments: [
      {method: 'card'}, {method: 'netbanking'},
    ]}},
    hide: [{method: 'upi'}],
    sequence: ['block.test_methods'],
    preferences: {show_default_blocks: false},
  }}};
}

export function checkoutFailure(response: RazorpayFailure | undefined, mode: string) {
  const detail = response?.error?.description?.trim().slice(0, 240)
    || 'Razorpay could not complete this payment.';
  const recovery = mode === 'test'
    ? 'Use the domestic test card shown above. For netbanking, select Success on the mock bank page. Real UPI apps cannot pay test QR codes.'
    : 'Try another payment method, or contact your bank if the decline continues.';
  return `${detail} ${recovery} Check payment status before paying again.`;
}
