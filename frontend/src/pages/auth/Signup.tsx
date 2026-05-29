import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { setAuthToken } from "@/lib/authToken";
import { MISSING_API_BASE_URL_MESSAGE } from "@/lib/runtimeConfig";
import { signup } from "@/services/auth.api";
import { authClient } from "@/services/authClient";
import { AuthLayout } from "@/components/layout/AuthLayout";

type SignupFormValues = {
  companyName: string;
  email: string;
  password: string;
};

export default function Signup() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>();
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function onSubmit(values: SignupFormValues) {
    setLoading(true);
    setServerError(null);

    try {
      const res = await signup({
        email: values.email,
        password: values.password,
        profile: { displayName: values.companyName.trim() },
      });
      // Store the 7-day session token
      const token = (res.sessionToken || res.idToken) as string | undefined;
      if (token) setAuthToken(token);

      // Verify the token works before navigating
      const authResult = await authClient.getCurrentUser();
      if (!authResult.authenticated || !authResult.user) {
        throw new Error("Authenticated session was not established.");
      }

      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message === MISSING_API_BASE_URL_MESSAGE
          ? "Sign up is unavailable because this frontend deployment is not connected to the API yet."
          : (err as { response?: { data?: { message?: string } } })?.response
              ?.data?.message || "Sign up failed. Please try again.";
      setServerError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      description="Set up Trackam for your logistics operation."
      footer={
        <span>
          By signing up, you agree to our{" "}
          <a href="#" className="text-stone-400 hover:text-white transition-colors underline underline-offset-2">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="#" className="text-stone-400 hover:text-white transition-colors underline underline-offset-2">
            Privacy Policy
          </a>
          .
        </span>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {serverError && (
          <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-xs text-red-400">
            {serverError}
          </p>
        )}

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-stone-300" htmlFor="companyName">
            Company name
          </label>
          <input
            id="companyName"
            type="text"
            placeholder="e.g. Fastline Logistics"
            {...register("companyName", { required: "Company name is required" })}
            className="w-full rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 h-10 text-sm text-white placeholder:text-stone-600 outline-none focus:border-orange-500/40 focus:ring-1 focus:ring-orange-500/20 transition-colors"
          />
          {errors.companyName && (
            <p className="text-xs text-red-400" role="alert">
              {errors.companyName.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-stone-300" htmlFor="email">
            Work email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@yourcompany.com"
            {...register("email", { required: "Email is required" })}
            className="w-full rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 h-10 text-sm text-white placeholder:text-stone-600 outline-none focus:border-orange-500/40 focus:ring-1 focus:ring-orange-500/20 transition-colors"
          />
          {errors.email && (
            <p className="text-xs text-red-400" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-stone-300" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register("password", {
              required: "Password is required",
              minLength: { value: 8, message: "Password must be at least 8 characters" },
            })}
            className="w-full rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 h-10 text-sm text-white placeholder:text-stone-600 outline-none focus:border-orange-500/40 focus:ring-1 focus:ring-orange-500/20 transition-colors"
          />
          {errors.password && (
            <p className="text-xs text-red-400" role="alert">
              {errors.password.message}
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
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </button>

        {/* What happens next */}
        <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] px-3.5 py-3 space-y-1.5">
          <p className="text-xs font-medium text-stone-300">What happens next</p>
          <ol className="text-xs text-stone-500 space-y-0.5 list-decimal list-inside">
            <li>Your Trackam account is created immediately</li>
            <li>Your OLI Switch operator account is submitted for approval</li>
            <li>You'll receive an API key by email once approved</li>
            <li>Paste the key in Settings — you're ready to dispatch</li>
          </ol>
        </div>

        <p className="text-xs text-center text-stone-500">
          Already have an account?{" "}
          <Link to="/auth/login" className="font-medium text-orange-400 hover:text-orange-300 transition-colors">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
