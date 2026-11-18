import React from "react";
import AuthForm from "@/components/AuthForm";
import LandingLayout from "@/components/shared/LandingLayout";

export default function SignupPage() {
  return (
    <LandingLayout>
      <div className="w-full flex justify-center items-center animate-in fade-in duration-700 zoom-in-95 my-4 sm:my-0 sm:mt-[-40px]">
        <div className="w-full max-w-[440px] px-2 sm:px-0">
          <AuthForm mode="signup" />
        </div>
      </div>
    </LandingLayout>
  );
}
