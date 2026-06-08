import { NextRequest } from "next/server";

export interface TenantSession {
  tenantId: string;
  userId: string;
}

/**
 * Extracts tenant information from the request.
 * In production, this would look up the session from JWT tokens or database session stores.
 * Here, we look at the 'x-tenant-id' header or fall back to 'default-tenant' for ease of integration and testing.
 */
export function getTenantSession(req: Request | NextRequest): TenantSession {
  let tenantId = "default-tenant";

  if (req && req.headers) {
    const headerTenant = req.headers.get("x-tenant-id");
    if (headerTenant) {
      tenantId = headerTenant;
    }
  }

  return {
    tenantId,
    userId: "mock-user-id-123",
  };
}
