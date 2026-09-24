"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/infrastructure/auth/auth-client.ts";
import { Button } from "@/components/ui/button.tsx";

export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await authClient.signOut();
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleLogout}
      disabled={isLoading}
      className="text-xs text-zinc-700"
    >
      {isLoading ? "Odhlašuji..." : "Odhlásit"}
    </Button>
  );
}
