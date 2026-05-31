import { useEffect, useState } from "react";
import {
  fetchAuthMe,
  fetchUser,
  type UserProfile,
} from "@/services/dashboard.api";

export default function AccountPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const me = await fetchAuthMe();
        const user = await fetchUser(me.uid);
        if (!active) return;
        setProfile(user);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-4 w-28 rounded-md bg-white/[0.06] animate-pulse" />
          <div className="h-3 w-64 rounded-md bg-white/[0.04] animate-pulse" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 animate-pulse space-y-3">
            <div className="h-3 w-24 rounded-md bg-white/[0.06]" />
            <div className="h-3 w-40 rounded-md bg-white/[0.04]" />
            <div className="h-3 w-32 rounded-md bg-white/[0.04]" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-sm text-red-400">
        Could not load your profile.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-white">Account</h2>
        <p className="text-sm text-stone-500">
          Basic information about your account.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
          <h3 className="text-sm font-medium text-stone-300 mb-3">Profile</h3>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-stone-500">Email</dt>
              <dd className="font-medium text-white">{profile.email}</dd>
            </div>
            {profile.displayName && (
              <div>
                <dt className="text-stone-500">Name</dt>
                <dd className="font-medium text-white">{profile.displayName}</dd>
              </div>
            )}
            {Array.isArray(profile.roles) && profile.roles.length > 0 && (
              <div>
                <dt className="text-stone-500">Roles</dt>
                <dd className="font-medium text-white">{profile.roles.join(", ")}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}
