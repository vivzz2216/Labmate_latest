import api from './api';
import type {RazorpayFailure, checkoutMethods} from './razorpay-checkout';

export interface Pack { id: string; name: string; amount: number; currency: string; credits: number; description: string; featured: boolean }
export interface Wallet { available: number; reserved: number; mode: string; billing_enabled: boolean }
export interface Catalogue { packs: Pack[]; trial_credits: number; mode: string; checkout_available: boolean; billing_enabled: boolean }
export interface Purchase { id: string; pack_id: string; pack_name: string; amount: number; currency: string; credits: number; status: string; gateway_order_id: string | null; key_id: string; mode: string; wallet: Wallet }
export const rupees = (paise: number) => new Intl.NumberFormat('en-IN', {style:'currency', currency:'INR', maximumFractionDigits:0}).format(paise / 100);
export const billingApi = {
  catalogue: (signal?: AbortSignal) => api.get<Catalogue>('/api/billing/plans', {signal, timeout:15000}).then(r=>r.data),
  wallet: (signal?: AbortSignal) => api.get<Wallet>('/api/billing/wallet', {signal, timeout:15000}).then(r=>r.data),
  order: (pack_id: string, request_key: string) => api.post<Purchase>('/api/billing/orders', {pack_id, request_key}, {timeout:30000}).then(r=>r.data),
  status: (id: string) => api.get<Purchase>(`/api/billing/orders/${id}`, {timeout:20000}).then(r=>r.data),
  reconcile: (id: string) => api.post<Purchase>(`/api/billing/orders/${id}/reconcile`, {}, {timeout:30000}).then(r=>r.data),
  verify: (id: string, response: RazorpayResponse) => api.post<Purchase>(`/api/billing/orders/${id}/verify`, response, {timeout:60000}).then(r=>r.data),
};
export interface RazorpayResponse { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
type RazorpayOptions = ReturnType<typeof checkoutMethods> & {
  key: string; amount: number; currency: string; name: string; description: string; order_id: string;
  prefill: {name: string; email: string}; theme: {color: string};
  handler: (response: RazorpayResponse) => void; modal: {ondismiss: () => void};
}
interface RazorpayInstance {open: () => void; on: (event: 'payment.failed', handler: (response: RazorpayFailure) => void) => void}
declare global { interface Window { Razorpay?: new (options: RazorpayOptions) => RazorpayInstance } }
let scriptPromise: Promise<void> | null = null;
export function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject)=>{
    const script=document.createElement('script');
    script.src='https://checkout.razorpay.com/v1/checkout.js'; script.async=true;
    const fail=()=>{clearTimeout(timer); script.remove(); scriptPromise=null; reject(new Error('Checkout could not load. Check your connection and retry.'));};
    const timer=setTimeout(fail,15000);
    script.onload=()=>{clearTimeout(timer); if(window.Razorpay)resolve();else fail();};
    script.onerror=fail; document.head.appendChild(script);
  });
  return scriptPromise;
}
export function paymentError(error: unknown): string {
  const value=error as {response?: {data?: {detail?: unknown}}; message?: string};
  const detail=value.response?.data?.detail;
  return typeof detail==='string' ? detail : value.message || 'This request could not finish. Please check payment status before retrying.';
}
