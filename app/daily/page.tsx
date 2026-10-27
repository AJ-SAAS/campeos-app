"use client";

import { useEffect, useState } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Sidebar } from "@/components/Sidebar";
import { SubscribeBanner } from "@/components/SubscribeBanner";
import { DailyReset } from "@/components/daily/DailyReset";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useRequireAccess } from "@/lib/firebase/useRequireAccess";
import { useSubscription } from "@/lib/firebase/useSubscription";
import { getBusinessProfile } from "@/lib/firebase/businessProfile";

// Daily Reset: a one-hour growth sprint. See components/daily/DailyReset.tsx.
export default function DailyPage() {
  const { user } = useAuth();
  const { ready } = useRequireAccess();
  const { loading: subLoading, active } = useSubscription();
  const [profile, setProfile] = useState<{ offerName: string; channels: string[] } | null>(null);

  useEffect(() => {
    if (!user) return;
    getBusinessProfile(user.uid)
      .then((p) => setProfile({ offerName: p?.name ?? "", channels: p?.channels ?? [] }))
      .catch(() => setProfile({ offerName: "", channels: [] }));
  }, [user]);

  if (!ready || !user) return <LoadingScreen />;

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-paper text-slate font-body">
      {!subLoading && !active && <SubscribeBanner />}
      <div className="flex-grow flex flex-col md:flex-row min-h-0">
        <Sidebar active="daily" />
        <main className="flex-grow min-w-0 min-h-0 overflow-y-auto px-4 py-7 sm:px-8 lg:px-14 lg:py-10 pb-28 md:pb-12">
          {profile ? (
            <DailyReset uid={user.uid} offerName={profile.offerName} userChannels={profile.channels} />
          ) : (
            <div className="h-[420px] max-w-[860px] rounded-[26px] bg-[#F8F8F8] animate-pulse" />
          )}
        </main>
      </div>
    </div>
  );
}
