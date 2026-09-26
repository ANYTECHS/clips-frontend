import React, { useState, useEffect, useRef } from "react";
import { Loader2, CheckCircle2, Wallet, Info } from "lucide-react";
import { useEmbeddedWallet } from "@/components/EmbeddedWalletProvider";
import { useToast } from "@/hooks/useToast";
import { fundWithFriendbot } from "@/app/lib/stellar";
import { IS_TESTNET } from "@/app/lib/networkConfig";
import { useBalance } from "@/app/hooks/useBalance";

const AlertCircle = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

interface WalletAwarenessStepProps {
  onContinue: () => void;
  loading: boolean;
}

export default function WalletAwarenessStep({ onContinue, loading }: WalletAwarenessStepProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [fundingSuccess, setFundingSuccess] = useState(false);
  const [fundingError, setFundingError] = useState<string | null>(null);
  const { wallet } = useEmbeddedWallet();
  const { success, error } = useToast();
  const isMountedRef = useRef(true);
  const fundedKeyRef = useRef<string | null>(null);

  const { refresh } = useBalance({
    publicKey: wallet?.publicKey || null,
    network: IS_TESTNET ? "TESTNET" : "PUBLIC",
    autoRefresh: false,
  });

  useEffect(() => {
    isMountedRef.current = true;

    // Auto-fund on testnet when wallet is available
    const fundWallet = async () => {
      if (!wallet?.publicKey) return;

      // Only fund once per wallet public key
      if (fundedKeyRef.current === wallet.publicKey) return;

      // Check conditions inside the effect body (not in deps)
      if (!IS_TESTNET) return;

      fundedKeyRef.current = wallet.publicKey;
      setIsFunding(true);
      setFundingError(null);
      
      try {
        await fundWithFriendbot(wallet.publicKey);
        if (!isMountedRef.current) return;
        setFundingSuccess(true);
        success("Wallet funded with 10,000 XLM!");
        
        // Refresh balance a few times to ensure it updates
        for (let retryCount = 0; retryCount < 5; retryCount++) {
          if (!isMountedRef.current) return;
          await new Promise(resolve => setTimeout(resolve, 1000));
          refresh();
        }
      } catch (err) {
        if (!isMountedRef.current) return;
        console.error("Friendbot funding failed:", err);
        setFundingError(err instanceof Error ? err.message : "Failed to fund wallet");
        error("Wallet funding failed. Please try again later.");
      } finally {
        if (isMountedRef.current) {
          setIsFunding(false);
        }
      }
    };

    fundWallet();

    return () => {
      isMountedRef.current = false;
    };
  }, [wallet?.publicKey]);

  return (
    <div className="w-full flex flex-col items-center justify-center animate-in zoom-in-95 fade-in duration-500 mt-12">
      <div className="w-full max-w-[480px] bg-surface/90 backdrop-blur-md rounded-[24px] p-8 sm:p-10 border border-border shadow-[0_4px_40px_rgba(0,0,0,0.5)] text-center">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center mx-auto mb-6">
          <Wallet className="w-8 h-8 text-brand" />
        </div>

        <h2 className="text-[32px] font-bold tracking-tight text-white mb-3">
          Your payment wallet is ready! 🎉
        </h2>
        <p className="text-muted text-[16px] leading-relaxed mb-6">
          We've automatically set up a Stellar wallet for you. You can use it to receive earnings, mint NFTs, and manage your creator payments — no crypto experience needed.
        </p>

        {/* Testnet Funding Status */}
        {IS_TESTNET && (
          <div className="mb-6 p-4 bg-brand/10 border border-brand/20 rounded-xl text-left">
            {isFunding && (
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-brand animate-spin" />
                <p className="text-[14px] font-bold text-brand">Funding your wallet with 10,000 XLM...</p>
              </div>
            )}
            {fundingSuccess && (
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-brand" />
                <p className="text-[14px] font-bold text-brand">Wallet funded with 10,000 XLM! 🎊</p>
              </div>
            )}
            {fundingError && !isFunding && (
              <div className="flex items-center gap-3">
                <Info className="w-5 h-5 text-amber-500" />
                <p className="text-[14px] font-bold text-amber-500">Funding temporarily unavailable. You can still continue.</p>
              </div>
            )}
          </div>
        )}

        {/* Mainnet CTA */}
        {!IS_TESTNET && (
          <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl text-left">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-white shrink-0 mt-0.5" />
              <div>
                <p className="text-[14px] font-bold text-white mb-1">Fund your wallet</p>
                <p className="text-[12px] text-muted leading-relaxed">
                  On mainnet, you'll need to fund your wallet with XLM to get started. You can do this from your dashboard after onboarding.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="relative inline-block mb-6">
          <button
            onClick={() => setShowTooltip(!showTooltip)}
            className="flex items-center gap-1.5 text-brand text-[13px] font-medium hover:underline mx-auto"
          >
            <Info className="w-4 h-4" />
            Learn more about your wallet
          </button>

          {showTooltip && (
            <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-72 bg-surface border border-border rounded-xl p-4 text-left shadow-xl z-10 animate-in fade-in slide-in-from-top-2 duration-200">
              <p className="text-[13px] text-white font-bold mb-2">What is a Stellar wallet?</p>
              <ul className="space-y-1.5 text-[12px] text-muted">
                <li>• It's like a bank account on the Stellar blockchain — fast and nearly free to use.</li>
                <li>• Your wallet is secured with AES-GCM encryption and stored only on your device.</li>
                <li>• You can export your secret key anytime from Settings → Advanced Wallet.</li>
                <li>• Earnings from your clips can be paid directly to this wallet.</li>
              </ul>
              <button
                onClick={() => setShowTooltip(false)}
                className="mt-3 text-[11px] text-muted hover:text-white transition-colors"
              >
                Got it ✕
              </button>
            </div>
          )}
        </div>

        {/* Backup Reminder */}
        <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-left animate-pulse">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[14px] font-bold text-amber-500 mb-1">Important: Backup your wallet!</p>
              <p className="text-[12px] text-amber-200/80 leading-relaxed">
                Since we don't store your keys, you must backup your secret key to ensure you never lose access to your funds. You can do this in your Dashboard settings later.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onContinue}
          disabled={loading || isFunding}
          className="w-full bg-brand hover:bg-brand-hover disabled:opacity-60 disabled:cursor-not-allowed text-black py-[15px] rounded-[12px] font-bold text-[15px] flex justify-center items-center gap-2 transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(0,229,143,0.1)]"
        >
          {loading || isFunding ? <Loader2 className="animate-spin w-5 h-5" /> : <>Go to Dashboard <CheckCircle2 className="w-[18px] h-[18px]" /></>}
        </button>
      </div>
    </div>
  );
}
