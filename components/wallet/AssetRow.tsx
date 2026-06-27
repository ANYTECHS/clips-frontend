import React from "react";
import { ExternalLink } from "lucide-react";

export interface AssetRowProps {
  code: string;
  balance: string;
  usdValue: number;
  usdDisplay?: string;
  pct: number;
  color: string;
  issuer?: string;
  network: string;
}

export function AssetRow({
  code,
  balance,
  usdValue,
  usdDisplay,
  pct,
  color,
  issuer,
  network,
}: AssetRowProps) {
  const explorerBase =
    network === "PUBLIC"
      ? "https://stellar.expert/explorer/public"
      : "https://stellar.expert/explorer/testnet";

  return (
    <div className="flex items-center gap-4 py-3 border-b border-border last:border-0">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black text-black shrink-0"
        style={{ backgroundColor: color }}
      >
        {code.slice(0, 3)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-white font-bold text-[13px]">{code}</span>
          {issuer && (
            <a
              href={`${explorerBase}/asset/${code}-${issuer}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View ${code} on Stellar Explorer`}
              className="text-muted hover:text-brand transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <div className="w-full bg-border rounded-full h-1 mt-1.5">
          <div
            className="h-1 rounded-full transition-all duration-500"
            style={{ width: `${pct * 100}%`, backgroundColor: color }}
          />
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-white font-bold text-[13px] font-mono">{balance}</p>
        <p className="text-muted text-[11px]">{usdDisplay ?? `$${usdValue.toFixed(2)}`}</p>
      </div>
    </div>
  );
}

export default AssetRow;
