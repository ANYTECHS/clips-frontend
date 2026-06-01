"use client";

/**
 * QRCodeDisplay.tsx
 *
 * Component to display a QR code for wallet addresses with download and copy functionality.
 * Uses the qrcode library to generate QR codes as canvas elements.
 *
 * Features:
 *  - Generate QR code from wallet address
 *  - Download QR code as PNG image
 *  - Visual feedback on interactions
 */

import React, { useEffect, useRef, useState } from "react";
import { Download, Copy, CheckCheck } from "lucide-react";
import QRCode from "qrcode";
import { useToast } from "@/hooks/useToast";

interface QRCodeDisplayProps {
  /** The wallet address or data to encode in the QR code */
  address: string;
  /** Optional label for the download filename */
  label?: string;
  /** Optional custom styling */
  className?: string;
  /** Show compact version with only icons */
  compact?: boolean;
}

export default function QRCodeDisplay({
  address,
  label = "wallet-qr",
  className = "",
  compact = false,
}: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  // Generate QR code on mount and when address changes
  useEffect(() => {
    if (!address || !canvasRef.current) return;

    const generateQRCode = async () => {
      try {
        setIsGenerating(true);
        // Generate QR code with optimized settings for wallet addresses
        await QRCode.toCanvas(canvasRef.current, address, {
          errorCorrectionLevel: "H", // High error correction
          type: "image/png",
          quality: 0.95,
          margin: 2,
          width: 256,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        });
        setIsGenerating(false);
      } catch (error) {
        console.error("Failed to generate QR code:", error);
        showToast("Failed to generate QR code", "error");
        setIsGenerating(false);
      }
    };

    generateQRCode();
  }, [address, showToast]);

  const handleDownload = () => {
    if (!canvasRef.current) return;

    try {
      const link = document.createElement("a");
      link.href = canvasRef.current.toDataURL("image/png");
      link.download = `${label}-${new Date().getTime()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("QR code downloaded successfully", "success");
    } catch (error) {
      console.error("Failed to download QR code:", error);
      showToast("Failed to download QR code", "error");
    }
  };

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      showToast("Wallet address copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy address:", error);
      showToast("Failed to copy address", "error");
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <button
          onClick={handleDownload}
          disabled={isGenerating}
          title="Download QR code"
          aria-label="Download QR code"
          className="p-2 rounded-[8px] bg-[#131A17] border border-[#1E2A24] text-[#5A6F65] hover:text-brand hover:border-brand/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <button
          onClick={handleCopyAddress}
          title="Copy wallet address"
          aria-label={copied ? "Address copied" : "Copy wallet address"}
          className="p-2 rounded-[8px] bg-[#131A17] border border-[#1E2A24] text-[#5A6F65] hover:text-brand hover:border-brand/30 transition-all"
        >
          {copied ? (
            <CheckCheck className="w-3.5 h-3.5 text-brand" aria-hidden="true" />
          ) : (
            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <div className="bg-white p-3 rounded-xl border border-[#E5E7EB] max-w-full">
        <canvas
          ref={canvasRef}
          className="w-64 h-64 block"
          aria-label={`QR code for wallet address: ${address}`}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleDownload}
          disabled={isGenerating}
          aria-busy={isGenerating}
          title="Download QR code as PNG"
          aria-label="Download QR code"
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand hover:bg-brand-hover text-black font-medium text-[13px] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          Download
        </button>
        <button
          onClick={handleCopyAddress}
          title="Copy wallet address to clipboard"
          aria-label={copied ? "Address copied" : "Copy address"}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-[13px] font-medium text-muted-foreground hover:text-white hover:bg-white/[0.1] transition-all"
        >
          {copied ? (
            <>
              <CheckCheck className="w-4 h-4 text-brand" aria-hidden="true" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" aria-hidden="true" />
              Copy Address
            </>
          )}
        </button>
      </div>

      <p className="text-[12px] text-[#5A6F65] text-center">
        Scan to receive {label.replace(/-/g, " ")}
      </p>
    </div>
  );
}
