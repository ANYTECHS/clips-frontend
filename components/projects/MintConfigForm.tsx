"use client";

import React, { useState } from "react";
import { calculateStellarMintCost, formatXlm } from "@/app/lib/mintUtils";

interface MintConfigFormProps {
  onSubmit: (data: {
    collectionName: string;
    description: string;
    creatorRoyalty: string;
    listingPrice: string;
  }) => Promise<any>;
}

export default function MintConfigForm({ onSubmit }: MintConfigFormProps) {
  const [collectionName, setCollectionName] = useState("");
  const [description, setDescription] = useState("");
  const [creatorRoyalty, setCreatorRoyalty] = useState("");
  const [listingPrice, setListingPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const clipCount = 1; // Defaulting to 1 for simplicity in this form. In a real app this might be dynamic.
  const { totalCost } = calculateStellarMintCost(clipCount);

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const validate = () => {
    if (!collectionName) return "Collection name is required.";
    if (collectionName.length < 3) return "Must be at least 3 characters.";
    if (!description) return "Description is required.";
    if (!creatorRoyalty) return "Royalty % is required.";
    
    const royaltyNum = parseFloat(creatorRoyalty);
    if (isNaN(royaltyNum) || royaltyNum < 0 || royaltyNum > 50) return "Must be between 0 and 50.";
    
    if (!listingPrice) return "Listing price is required.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ collectionName: true, description: true, creatorRoyalty: true, listingPrice: true });
    
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        collectionName,
        description,
        creatorRoyalty,
        listingPrice,
      });
      // The parent handles success states
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFieldError = (field: string) => {
    if (!touched[field]) return null;
    if (field === "collectionName") {
      if (!collectionName) return "Collection name is required.";
      if (collectionName.length < 3) return "Must be at least 3 characters.";
    }
    if (field === "description" && !description) return "Description is required.";
    if (field === "creatorRoyalty") {
      if (!creatorRoyalty) return "Royalty % is required.";
      const num = parseFloat(creatorRoyalty);
      if (isNaN(num) || num < 0 || num > 50) return "Must be between 0 and 50.";
    }
    if (field === "listingPrice" && !listingPrice) return "Listing price is required.";
    return null;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      <div className="space-y-1">
        <label className="text-sm font-medium text-white/80">Collection Name</label>
        <input
          name="collectionName"
          type="text"
          value={collectionName}
          onChange={(e) => setCollectionName(e.target.value)}
          onBlur={() => handleBlur("collectionName")}
          className="w-full bg-input border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-brand/50"
          placeholder="e.g. My Awesome Clips"
        />
        {getFieldError("collectionName") && (
          <p className="text-red-500 text-xs">{getFieldError("collectionName")}</p>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-white/80">Description</label>
        <textarea
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => handleBlur("description")}
          className="w-full bg-input border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-brand/50"
          placeholder="Describe your collection..."
          rows={3}
        />
        {getFieldError("description") && (
          <p className="text-red-500 text-xs">{getFieldError("description")}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-white/80">Creator Royalty (%)</label>
          <input
            name="creatorRoyalty"
            type="number"
            value={creatorRoyalty}
            onChange={(e) => setCreatorRoyalty(e.target.value)}
            onBlur={() => handleBlur("creatorRoyalty")}
            className="w-full bg-input border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-brand/50"
            placeholder="e.g. 10"
          />
          {getFieldError("creatorRoyalty") && (
            <p className="text-red-500 text-xs">{getFieldError("creatorRoyalty")}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-white/80">Listing Price</label>
          <input
            name="listingPrice"
            type="number"
            step="0.01"
            value={listingPrice}
            onChange={(e) => setListingPrice(e.target.value)}
            onBlur={() => handleBlur("listingPrice")}
            className="w-full bg-input border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-brand/50"
            placeholder="e.g. 0.5"
          />
          {getFieldError("listingPrice") && (
            <p className="text-red-500 text-xs">{getFieldError("listingPrice")}</p>
          )}
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 p-4 rounded-xl mt-4">
        <div className="flex justify-between items-center text-sm">
          <span className="text-white/60">Estimated Mint Fee</span>
          <span className="font-mono text-brand font-bold">{formatXlm(totalCost)}</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-brand hover:bg-brand-hover text-black font-bold py-3 rounded-xl transition-all disabled:opacity-50"
      >
        {isSubmitting ? "Minting..." : error && error.includes("went wrong") ? "Retry Minting" : "Mint Collection"}
      </button>
    </form>
  );
}
