"use client";

import { useEffect } from "react";
import { migrateCryptoSalt } from "@/app/lib/secureStorage";

export default function CryptoSaltInitializer() {
  useEffect(() => {
    migrateCryptoSalt();
  }, []);

  return null;
}
