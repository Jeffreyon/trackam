import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, CheckCircle2, Mail } from "lucide-react";
import { getAuthToken } from "@/lib/authToken";
import { verifyEmail } from "@/services/auth.api";
import { AuthLayout } from "@/components/layout/AuthLayout";

export default function VerifyEmail() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = getAuthToken();

  async function handleSend() {
    if (!token) return;
    setError(null);
    setLoading(true);

    try {
      await verifyEmail({ idToken: token });
      setSent(true);
    } catch (err) {
      console.error(err);
      setError("Failed to send verification email. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Auto-send on mount if token is available
    if (token && !sent) {
      handleSend();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthLayout
      title="Verify your email"
      description="Confirm your email address to complete setup."
    >
      <div className="space-y-4">
        {sent ? (
          <div className="text-center space-y-3 py-2">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              </div>
            </div>
            <p className="text-sm text-stone-300">
              Verification email sent. Check your inbox.
            </p>
            <p className="text-xs text-stone-500">
              Didn't receive it? Check your spam folder or try again.
            </p>
            <button
              onClick={handleSend}
              disabled={loading}
              className="text-xs font-medium text-orange-400 hover:text-orange-300 transition-colors disabled:opacity-60"
            >
              {loading ? "Sending…" : "Resend email"}
            </button>
          </div>
        ) : error ? (
          <div className="text-center space-y-3 py-2">
            <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-xs text-red-400">
              {error}
            </p>
            <button
              onClick={handleSend}
              disabled={loading}
              className="w-full rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 h-10 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Try again"}
            </button>
          </div>
        ) : !token ? (
          <div className="text-center space-y-3 py-2">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                <Mail className="h-6 w-6 text-orange-400" />
              </div>
            </div>
            <p className="text-sm text-stone-300">
              Please sign in first to verify your email.
            </p>
            <Link
              to="/auth/login"
              className="inline-block text-xs font-medium text-orange-400 hover:text-orange-300 transition-colors"
            >
              Go to sign in →
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
            <span className="ml-2 text-sm text-stone-400">Sending verification email…</span>
          </div>
        )}

        <p className="text-xs text-center text-stone-500">
          <Link
            to="/dashboard"
            className="font-medium text-orange-400 hover:text-orange-300 transition-colors"
          >
            Go to dashboard →
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
