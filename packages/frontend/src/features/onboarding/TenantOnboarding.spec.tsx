import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TenantOnboarding } from './TenantOnboarding';
import {
  EMPTY_TENANT_FORM,
  toOnboardingInput,
  validateTenantForm,
} from './tenant-form.model';

const onboardTenant = vi.fn();
vi.mock('./onboard-tenant.service', () => ({
  onboardTenant: (...args: unknown[]) => onboardTenant(...args),
}));

const TENANT = '11111111-2222-3333-4444-555555555555';

describe('tenant form model', () => {
  it('requires the core fields and a platform', () => {
    const errors = validateTenantForm(EMPTY_TENANT_FORM);
    expect(Object.keys(errors).sort()).toEqual(
      ['factory_or_workspace_name', 'platform', 'tenant_id', 'tenant_name'].sort()
    );
  });

  it('rejects malformed GUIDs, emails, and intervals', () => {
    const errors = validateTenantForm({
      ...EMPTY_TENANT_FORM,
      tenant_id: 'not-a-guid',
      tenant_name: 'Contoso',
      platform: 'AzureDataFactory',
      factory_or_workspace_name: 'adf',
      subscription_id: 'abc',
      admin_email: 'nope',
      refresh_interval: '1.5',
    });
    expect(errors).toMatchObject({
      tenant_id: expect.any(String),
      subscription_id: expect.any(String),
      admin_email: expect.any(String),
      refresh_interval: expect.any(String),
    });
  });

  it('drops blank optionals and fields that do not apply to the platform', () => {
    const input = toOnboardingInput({
      ...EMPTY_TENANT_FORM,
      tenant_id: ` ${TENANT} `,
      tenant_name: ' Contoso ',
      platform: 'Fabric',
      factory_or_workspace_name: 'Sales',
      subscription_id: TENANT,
      resource_group: 'rg',
      fabric_workspace_id: '',
      admin_email: '  ',
      refresh_interval: '30',
    });
    expect(input).toEqual({
      tenant_id: TENANT,
      tenant_name: 'Contoso',
      platform: 'Fabric',
      subscription_id: undefined,
      resource_group: undefined,
      factory_or_workspace_name: 'Sales',
      fabric_workspace_id: undefined,
      admin_name: undefined,
      admin_email: undefined,
      refresh_interval: 30,
    });
  });
});

describe('TenantOnboarding', () => {
  beforeEach(() => {
    onboardTenant.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  function fillRequired() {
    fireEvent.change(screen.getByLabelText('Tenant ID'), { target: { value: TENANT } });
    fireEvent.change(screen.getByLabelText('Tenant name'), { target: { value: 'Contoso' } });
    fireEvent.click(screen.getByLabelText(/Azure Data Factory/));
    fireEvent.change(screen.getByLabelText('Data factory name'), {
      target: { value: 'adf-contoso' },
    });
  }

  it('shows validation errors instead of submitting an incomplete form', async () => {
    render(<TenantOnboarding />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Onboard tenant/ })));
    expect(screen.getByText('Tenant ID is required.')).toBeVisible();
    expect(onboardTenant).not.toHaveBeenCalled();
  });

  it('shows Azure fields for Data Factory and the workspace ID for Fabric', () => {
    render(<TenantOnboarding />);
    fireEvent.click(screen.getByLabelText(/Azure Data Factory/));
    expect(screen.getByLabelText('Subscription ID')).toBeVisible();
    expect(screen.queryByLabelText('Fabric workspace ID')).toBeNull();
    fireEvent.click(screen.getByLabelText(/Microsoft Fabric/));
    expect(screen.getByLabelText('Fabric workspace ID')).toBeVisible();
    expect(screen.queryByLabelText('Subscription ID')).toBeNull();
  });

  it('submits and confirms the saved tenant', async () => {
    onboardTenant.mockResolvedValue({
      ok: true,
      tenant: { id: TENANT, tenant_name: 'Contoso', platform: 'AzureDataFactory' },
    });
    render(<TenantOnboarding />);
    fillRequired();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Onboard tenant/ })));
    expect(onboardTenant).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: TENANT, platform: 'AzureDataFactory', refresh_interval: 60 })
    );
    expect(await screen.findByRole('heading', { name: 'Tenant onboarded' })).toBeVisible();
  });

  it('keeps the entries and flags the field when the tenant already exists', async () => {
    onboardTenant.mockResolvedValue({
      ok: false,
      reason: 'duplicate',
      message: 'This tenant is already onboarded.',
      field: 'tenant_id',
    });
    render(<TenantOnboarding />);
    fillRequired();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Onboard tenant/ })));
    expect(screen.getByText('This tenant is already onboarded.')).toBeVisible();
    expect(screen.getByLabelText('Tenant name')).toHaveValue('Contoso');
  });

  it('surfaces a request failure without losing the form', async () => {
    onboardTenant.mockRejectedValue(new Error("Couldn't reach the onboarding service."));
    render(<TenantOnboarding />);
    fillRequired();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Onboard tenant/ })));
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't reach the onboarding service.");
    expect(screen.getByLabelText('Tenant ID')).toHaveValue(TENANT);
  });
});
