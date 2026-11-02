"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { verifyEmail } from "@/lib/api";
import { Spinner } from "./parts";

export function VerifyEmail({ token, signedIn }: { token: string; signedIn: boolean }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    verifyEmail(token)
      .then(() => router.replace(signedIn ? "/dashboard" : "/login?verified=email"))
      .catch(() => setFailed(true));
  }, [token, signedIn, router]);

  return (
    <div className="fcard">
      <div className="view">
        <h1 className="ttl">Your email.</h1>
        {failed ? (
          <div className="fields" style={{ marginTop: 22 }}>
            <div className="banner" role="alert">
              <Icon name="alert" size={18} />
              <span>This link has expired.</span>
            </div>
            <Link href={signedIn ? "/settings#profile" : "/login"} className="btn b-m full">
              {signedIn ? "Go to settings" : "Log in"}
            </Link>
          </div>
        ) : (
          <p className="sub" role="status" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Spinner />
            Confirming your email…
          </p>
        )}
      </div>
    </div>
  );
}
