"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/BasicAuthContext";

/** Student pages: send visitors who are not signed in back to the home page once the session check has finished. */
export function useRequireUser() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);
  return { user, loading };
}
