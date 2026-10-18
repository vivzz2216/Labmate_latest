import CheckoutPanel from '@/components/billing/CheckoutPanel';

export default async function CheckoutPage({searchParams}:{searchParams:Promise<{pack?:string}>}) {
  const params=await searchParams;
  return <CheckoutPanel packId={params.pack||'lab-pack'}/>;
}
