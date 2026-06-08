"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface TenantContextType {
  tenantId: string;
  setTenantId: (id: string) => void;
}

const TenantContext = createContext<TenantContextType>({
  tenantId: "test-tenant-1",
  setTenantId: () => {},
});

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenantId, setTenantIdState] = useState("test-tenant-1");

  useEffect(() => {
    const stored = localStorage.getItem("shopos_tenant_id");
    if (stored) {
      setTenantIdState(stored);
    }
  }, []);

  const setTenantId = (id: string) => {
    setTenantIdState(id);
    localStorage.setItem("shopos_tenant_id", id);
    // Refresh page to reload data for the new tenant
    window.location.reload();
  };

  return (
    <TenantContext.Provider value={{ tenantId, setTenantId }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
