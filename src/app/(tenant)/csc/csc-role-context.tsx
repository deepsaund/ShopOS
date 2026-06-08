"use client";

import React, { createContext, useContext } from "react";

export type CscUserRole = "ADMIN" | "STAFF" | "CUSTOMER" | "B2B";

export interface CscRoleContextType {
  role: CscUserRole;
  setRole: (role: CscUserRole) => void;
  staffId: string;
  simulatedStaffName: string;
  customerId: string;
  setCustomerId: (id: string) => void;
}

export const CscRoleContext = createContext<CscRoleContextType>({
  role: "ADMIN",
  setRole: () => {},
  staffId: "staff-1",
  simulatedStaffName: "Arjun Kumar",
  customerId: "",
  setCustomerId: () => {},
});

export function useCscRole() {
  return useContext(CscRoleContext);
}
