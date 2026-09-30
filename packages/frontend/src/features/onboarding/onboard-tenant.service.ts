//-----------------------------------------------------------------------
// Submits the onboarding form to the trusted `onboardTenant` function.
//-----------------------------------------------------------------------

import { NetworkError } from '@microsoft/rayfin-lib';
import type {
  OnboardTenantResult,
  TenantOnboardingInput,
} from '@rayfin-app/shared';

import { getRayfinClient, MissingRayfinConfigError } from '@/lib/rayfin-client';

/** A failure the person can act on, with provider internals stripped. */
export class OnboardingRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OnboardingRequestError';
  }
}

export async function onboardTenant(
  tenant: TenantOnboardingInput
): Promise<OnboardTenantResult> {
  try {
    const client = await getRayfinClient();
    return await client.functions.onboardTenant.invoke({ tenant });
  } catch (error) {
    console.error('onboardTenant failed', error);
    throw toRequestError(error);
  }
}

function toRequestError(error: unknown): OnboardingRequestError {
  if (error instanceof MissingRayfinConfigError) {
    return new OnboardingRequestError(
      'This app is missing its backend configuration, so the tenant could not be saved.'
    );
  }
  if (error instanceof NetworkError) {
    if (error.status === 401 || error.status === 403) {
      return new OnboardingRequestError(
        "You don't have permission to onboard tenants. Ask a workspace admin for access."
      );
    }
    return new OnboardingRequestError(
      "Couldn't reach the onboarding service. Check your connection and try again."
    );
  }
  return new OnboardingRequestError(
    'The tenant could not be saved because the onboarding service reported an error. Try again, and contact support if it keeps happening.'
  );
}
