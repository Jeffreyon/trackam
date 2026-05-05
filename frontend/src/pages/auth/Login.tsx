import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { clearAuthToken, setAuthToken } from "@/lib/authToken";
import { MISSING_API_BASE_URL_MESSAGE } from "@/lib/runtimeConfig";
import { login } from "@/services/auth.api";
import { authClient } from "@/services/authClient";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { useToast } from "@/hooks/useToast";

type LoginFormValues = {
  email: string;
  password: string;
};

export default function Login() {
  const navigate = useNavigate();
  const { success, error: showErrorToast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>();
  const [loading, setLoading] = useState(false);

  async function onSubmit(values: LoginFormValues) {
    setLoading(true);

    try {
      const res = await login(values);
      if (res.idToken) {
        setAuthToken(res.idToken);
      }

      const authResult = await authClient.getCurrentUser();
      if (!authResult.authenticated || !authResult.user) {
        throw new Error("Authenticated session was not established.");
      }

      const isAdmin = authResult.isAdmin;
      success(
        isAdmin ? "Welcome back, admin." : "Welcome back.",
        "Signed in"
      );
      navigate("/dashboard", {
        replace: true,
      });
    } catch (err) {
      clearAuthToken();
      console.error(err);

      const message =
        err instanceof Error && err.message === MISSING_API_BASE_URL_MESSAGE
          ? "Login is unavailable because this frontend deployment is not connected to the API yet."
          : "Login failed. Check your credentials and try again.";

      showErrorToast(
        message,
        "Login failed"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Log in"
      description="Access your account to manage your app."
      footer={
        <span>
          By continuing, you agree to our{" "}
          <a href="#" className="underline underline-offset-2">
            Terms
          </a>{" "}
          and{" "}
          <a href="#" className="underline underline-offset-2">
            Privacy Policy
          </a>
          .
        </span>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            {...register("email", { required: "Email is required" })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          {errors.email && (
            <p className="text-xs text-destructive" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            {...register("password", { required: "Password is required" })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          {errors.password && (
            <p className="text-xs text-destructive" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span />
          <Link
            to="/auth/forgot-password"
            className="text-xs font-medium text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
        >
          {loading ? "Logging in..." : "Log in"}
        </button>
        <p className="text-xs text-center text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            to="/auth/signup"
            className="font-medium text-primary hover:underline"
          >
            Sign up
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
