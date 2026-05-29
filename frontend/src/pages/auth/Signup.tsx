import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { setAuthToken } from "@/lib/authToken";
import { signup } from "@/services/auth.api";
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
      if (res.idToken) {
        setAuthToken(res.idToken as string);
      }
      navigate("/dashboard");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Sign up failed. Please try again.";
      setServerError(msg);
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
          <a href="#" className="underline underline-offset-2">
            Terms of Service
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
          <label className="block text-sm font-medium" htmlFor="companyName">
            Company name
          </label>
          <input
            id="companyName"
            type="text"
            placeholder="e.g. Fastline Logistics"
            {...register("companyName", { required: "Company name is required" })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          {errors.companyName && (
            <p className="text-xs text-destructive" role="alert">
              {errors.companyName.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="email">
            Work email
          </label>
          <input
            id="email"
            type="email"
            placeholder="you@yourcompany.com"
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
            {...register("password", {
              required: "Password is required",
              minLength: { value: 8, message: "Password must be at least 8 characters" },
            })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          {errors.password && (
            <p className="text-xs text-destructive" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>

        {serverError && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {serverError}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>

        {/* What happens next */}
        <div className="rounded-md bg-muted/60 px-3 py-2.5 space-y-1">
          <p className="text-xs font-medium text-foreground">What happens next</p>
          <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal list-inside">
            <li>Your Trackam account is created immediately</li>
            <li>Your OLI Switch operator account is submitted for approval</li>
            <li>You'll receive an API key by email once approved</li>
            <li>Paste the key in Settings — you're ready to dispatch</li>
          </ol>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Already have an account?{" "}
          <Link to="/auth/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
