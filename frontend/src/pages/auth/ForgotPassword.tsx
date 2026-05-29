import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { Loader2, CheckCircle2 } from "lucide-react";
import { forgotPassword } from "@/services/auth.api";
import { AuthLayout } from "@/components/layout/AuthLayout";

type ForgotPasswordFormValues = {
  email: string;
};

export default function ForgotPassword() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(values: ForgotPasswordFormValues) {
    setServerError(null);
    setLoading(true);

    try {
      await forgotPassword(values);
      setSent(true);
    } catch (err) {
      console.error(err);
      setServerError("Failed to send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      description="Enter the email associated with your account."
    >
      {sent ? (
        <div className="text-center space-y-3 py-2">
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            </div>
          </div>
          <p className="text-sm text-stone-300">
            If an account exists for that email, a reset link has been sent.
          </p>
          <p className="text-xs text-stone-500">
            Check your inbox and spam folder.
          </p>
          <Link
            to="/auth/login"
            className="inline-block mt-2 text-xs font-medium text-orange-400 hover:text-orange-300 transition-colors"
          >
            ← Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-xs text-red-400">
              {serverError}
            </p>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-stone-300" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register("email", { required: "Email is required" })}
              className="w-full rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 h-10 text-sm text-white placeholder:text-stone-600 outline-none focus:border-orange-500/40 focus:ring-1 focus:ring-orange-500/20 transition-colors"
            />
            {errors.email && (
              <p className="text-xs text-red-400" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 h-10 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              "Send reset link"
            )}
          </button>

          <p className="text-xs text-center text-stone-500">
            Remember your password?{" "}
            <Link
              to="/auth/login"
              className="font-medium text-orange-400 hover:text-orange-300 transition-colors"
            >
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
