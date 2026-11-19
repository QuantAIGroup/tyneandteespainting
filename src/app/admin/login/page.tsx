import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Admin login", robots: { index: false, follow: false } };

export default function LoginPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-cream px-5">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm ring-1 ring-navy-900/10">
        <h1 className="text-2xl">Admin login</h1>
        <p className="mt-2 text-sm text-navy-600">Sign in to manage enquiries, prices and your gallery.</p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
