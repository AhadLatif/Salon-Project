import { redirect } from 'next/navigation';

/** Entry point — land on the guarded shell; the guard bounces to /login if needed. */
export default function Home() {
  redirect('/dashboard');
}
