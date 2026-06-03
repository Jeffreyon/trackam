import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { setAuthToken } from "@/lib/authToken";
import { MISSING_API_BASE_URL_MESSAGE } from "@/lib/runtimeConfig";
import { login } from "@/services/auth.api";
import { authClient } from "@/services/authClient";
import { AuthLayout } from "@/components/layout/AuthLayout";

type LoginFormValues = {
  email: string;
  password: string;
};

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>();
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(values: LoginFormValues) {
    setLoading(true);
    setServerError(null);

    try {
      const res = await login(values);

      // Store the 7-day session token (falls back to 1h idToken for
      // older backends that haven't deployed the sessionToken change yet)
      const token = (res.sessionToken || res.idToken) as string | undefined;
      if (token) setAuthToken(token);

      // Verify the token works before navigating
      const authResult = await authClient.getCurrentUser();
      if (!authResult.authenticated || !authResult.user) {
        throw new Error("Authenticated session was not established.");
      }

      const isAdmin = await authClient.checkIsAdmin();
      const defaultDest = isAdmin ? "/admin/dashboard" : "/dashboard";
      const redirectTo = searchParams.get("redirect") || defaultDest;
      navigate(redirectTo, { replace: true });
    } catch (err) {
      console.error(err);

      const message =
        err instanceof Error && err.message === MISSING_API_BASE_URL_MESSAGE
          ? "Login is unavailable because this frontend deployment is not connected to the API yet."
          : "Invalid email or password. Please try again.";

      setServerError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to your Trackam dashboard."
      footer={
        <span>
          By continuing, you agree to our{" "}
          <a href="#" className="text-stone-400 hover:text-white transition-colors underline underline-offset-2">
            Terms
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

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-stone-300" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register("password", { required: "Password is required" })}
            className="w-full rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 h-10 text-sm text-white placeholder:text-stone-600 outline-none focus:border-orange-500/40 focus:ring-1 focus:ring-orange-500/20 transition-colors"
          />
          {errors.password && (
            <p className="text-xs text-red-400" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end">
          <Link
            to="/auth/forgot-password"
            className="text-xs font-medium text-stone-400 hover:text-white transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 h-10 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>

        <p className="text-xs text-center text-stone-500">
          Don&apos;t have an account?{" "}
          <Link
            to="/auth/signup"
            className="font-medium text-orange-400 hover:text-orange-300 transition-colors"
          >
            Sign up
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
