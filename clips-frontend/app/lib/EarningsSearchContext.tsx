"use client";

import React, { createContext, useContext, useState } from "react";

interface EarningsSearchContextType {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
}

const EarningsSearchContext = createContext<EarningsSearchContextType>({
  searchQuery: "",
  setSearchQuery: () => {},
});

export const useEarningsSearch = () => useContext(EarningsSearchContext);

export function EarningsSearchProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <EarningsSearchContext.Provider value={{ searchQuery, setSearchQuery }}>
      {children}
    </EarningsSearchContext.Provider>
  );
}
