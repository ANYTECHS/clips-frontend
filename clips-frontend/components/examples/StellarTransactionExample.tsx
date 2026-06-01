"use client";

import React, { useState } from "react";
import { useStellarTransaction } from "@/app/hooks/useStellarTransaction";
import { Loader2, CheckCircle2, AlertCircle, Wallet, ExternalLink, FlaskConical } from "lucide-react";
import { getStellarLabUrl } from "@/app/lib/networkConfig";

/**
 * Example component demonstrating how to use the useStellarTransaction hook
 * 
 * This shows:
 * - Basic transaction execution
 * - Status handling
 * - Error handling
 * - Success callbacks
 */
export default function StellarTransactionExample() {
  const [amount, setAmount] = useState("10");
  const [destination, setDestination] = useState("");

  const {
    executeTransaction,
    status,
    isLoading,
    error,
    result,
    transactionHash,
    reset,
    checkFreighterInstalled,
  } = useStellarTransaction({
    network: "testnet",
    maxRetries: 3,
    onSuccess: (result) => {
      console.log("Transaction successful!", result);
    },
    onError: (error) => {
      console.error("Transaction failed:", error);
    },
  });

  /**
   * Build a simple payment transaction
   * In a real app, you would use stellar-sdk to build this
   */
  const buildPaymentTransaction = async (): Promise<string> => {
    // Simulate building a transaction
    // In reality, you'd use stellar-sdk like this:
    /*
    const StellarSdk = require('stellar-sdk');
    const server = new StellarSdk.Server('https://horizon-testnet.stellar.org');
    
    const sourceKeys = StellarSdk.Keypair.fromSecret(sourceSecret);
    const account = await server.loadAccount(sourceKeys.publicKey());
    
    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: destination,
          asset: StellarSdk.Asset.native(),
          amount: amount,
        })
      )
      .setTimeout(30)
      .build();
    
    return transaction.toXDR();
    */

    // For demo purposes, return a mock XDR
    await new Promise((resolve) => setTimeout(resolve, 500));
    return "mock_transaction_xdr_string";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!checkFreighterInstalled()) {
      return;
    }

    await executeTransaction(buildPaymentTransaction);
  };

  const handleReset = () => {
    reset();
    setAmount("10");
    setDestination("");
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-surface border border-border rounded-[24px] p-8">
        <h2 className="text-2xl font-bold text-white mb-2">
          Stellar Transaction Example
        </h2>
        <p className="text-muted text-sm mb-6">
          Demonstrates the useStellarTransaction hook with a payment transaction
        </p>

        {/* Success State */}
        {status === "success" && result && (
          <div className="mb-6 p-4 bg-brand/10 border border-brand/30 rounded-xl">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-brand shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white mb-1">
                  Transaction Successful!
                </p>
                <p className="text-xs text-muted mb-2">
                  Your payment has been submitted to the Stellar network.
                </p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">Hash:</span>
                    <code className="text-xs text-brand font-mono">
                      {transactionHash}
                    </code>
                    <div className="flex items-center gap-1.5 ml-2">
                      <a
                        href={`https://stellar.expert/explorer/testnet/tx/${transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted hover:text-brand transition-colors"
                        title="View on explorer"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <a
                        href={getStellarLabUrl(transactionHash || "")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted hover:text-brand transition-colors"
                        title="Open in Stellar Lab"
                      >
                        <FlaskConical className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">Ledger:</span>
                    <span className="text-xs text-white">{result.ledger}</span>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="mt-3 text-xs text-brand hover:underline"
                >
                  Send another payment
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {status === "error" && error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white mb-1">
                  Transaction Failed
                </p>
                <p className="text-xs text-red-300 mb-1">{error.message}</p>
                <p className="text-xs text-red-400/70">Code: {error.code}</p>
                <button
                  onClick={reset}
                  className="mt-3 text-xs text-red-400 hover:underline"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Transaction Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-muted mb-2">
              Destination Address
            </label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              disabled={isLoading}
              className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-subtle focus:outline-none focus:border-brand/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-muted mb-2">
              Amount (XLM)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="10"
              min="0.0000001"
              step="0.1"
              disabled={isLoading}
              className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-subtle focus:outline-none focus:border-brand/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              required
            />
          </div>

          {/* Status Indicator */}
          {isLoading && (
            <div className="p-3 bg-surface-hover border border-border rounded-xl">
              <div className="flex items-center gap-3">
                <Loader2 className="w-4 h-4 text-brand animate-spin shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium">
                    {status === "building" && "Building transaction..."}
                    {status === "signing" && "Waiting for signature..."}
                    {status === "submitting" && "Submitting to network..."}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {status === "signing" &&
                      "Please approve the transaction in Freighter"}
                    {status === "submitting" &&
                      "This may take a few seconds"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !destination || !amount}
            className="w-full bg-brand hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(0,229,143,0.15)] hover:shadow-[0_0_30px_rgba(0,229,143,0.25)]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Wallet className="w-4 h-4" />
                Send Payment
              </>
            )}
          </button>
        </form>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-surface-hover border border-border rounded-xl">
          <p className="text-xs text-muted">
            <strong className="text-white">Note:</strong> This example uses the
            Stellar testnet. Make sure you have Freighter wallet installed and
            connected to testnet. You can get test XLM from the{" "}
            <a
              href="https://laboratory.stellar.org/#account-creator?network=test"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline"
            >
              Stellar Laboratory
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
