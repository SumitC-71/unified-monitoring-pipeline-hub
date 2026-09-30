//-----------------------------------------------------------------------
// Tenant onboarding — collects a tenant's configuration and saves it to the
// TenantConfiguration table through the `onboardTenant` function.
//-----------------------------------------------------------------------

import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowRight,
  Check,
  CircleAlert,
  CircleCheck,
  Factory,
  Layers,
  LoaderCircle,
  RotateCcw,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import type {
  OnboardTenantResult,
  TenantOnboardingField,
  TenantPlatform,
} from '@rayfin-app/shared';

import { Button, Field, TextInput } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';

import { onboardTenant } from './onboard-tenant.service';
import {
  EMPTY_TENANT_FORM,
  MAX_LENGTH,
  PLATFORM_OPTIONS,
  REFRESH_PRESETS,
  platformOption,
  toOnboardingInput,
  validateTenantForm,
  type TenantFormErrors,
  type TenantFormValues,
} from './tenant-form.model';

const PLATFORM_ICONS: Record<TenantPlatform, LucideIcon> = {
  AzureDataFactory: Factory,
  AzureSynapse: Warehouse,
  Fabric: Layers,
};

type SectionId = 'tenant' | 'platform' | 'source' | 'admin' | 'schedule';

const SECTIONS: readonly {
  id: SectionId;
  title: string;
  fields: readonly TenantOnboardingField[];
  optional?: boolean;
}[] = [
  { id: 'tenant', title: 'Tenant', fields: ['tenant_id', 'tenant_name'] },
  { id: 'platform', title: 'Platform', fields: ['platform'] },
  {
    id: 'source',
    title: 'Source location',
    fields: [
      'factory_or_workspace_name',
      'subscription_id',
      'resource_group',
      'fabric_workspace_id',
    ],
  },
  {
    id: 'admin',
    title: 'Admin contact',
    fields: ['admin_name', 'admin_email'],
    optional: true,
  },
  { id: 'schedule', title: 'Ingestion schedule', fields: ['refresh_interval'] },
];

/** Required values that must be filled before a section counts as ready. */
const REQUIRED: readonly (keyof TenantFormValues)[] = [
  'tenant_id',
  'tenant_name',
  'platform',
  'factory_or_workspace_name',
  'refresh_interval',
];

type Status =
  | { kind: 'editing' }
  | { kind: 'submitting' }
  | { kind: 'saved'; tenant: Extract<OnboardTenantResult, { ok: true }>['tenant'] };

export function TenantOnboarding() {
  const [values, setValues] = useState<TenantFormValues>(EMPTY_TENANT_FORM);
  const [touched, setTouched] = useState<Partial<Record<keyof TenantFormValues, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<TenantFormErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'editing' });

  const errors = useMemo(() => validateTenantForm(values), [values]);
  const option = platformOption(values.platform);
  const submitting = status.kind === 'submitting';

  const visibleError = (field: TenantOnboardingField) =>
    serverErrors[field] ?? (submitted || touched[field] ? errors[field] : undefined);

  const sectionReady = (id: SectionId) => {
    const section = SECTIONS.find((s) => s.id === id)!;
    return section.fields.every(
      (field) =>
        !errors[field] &&
        !serverErrors[field] &&
        (!REQUIRED.includes(field) || values[field].trim() !== '')
    );
  };

  const set = <K extends keyof TenantFormValues>(field: K, value: TenantFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    setServerErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const blur = (field: keyof TenantFormValues) =>
    setTouched((current) => ({ ...current, [field]: true }));

  const reset = () => {
    setValues(EMPTY_TENANT_FORM);
    setTouched({});
    setSubmitted(false);
    setServerErrors({});
    setRequestError(null);
    setStatus({ kind: 'editing' });
  };

  const focusField = (field: TenantOnboardingField) => {
    const target =
      field === 'platform'
        ? document.querySelector<HTMLInputElement>('input[name="platform"]')
        : document.getElementById(field);
    target?.focus();
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitted(true);
    setRequestError(null);

    const firstInvalid = SECTIONS.flatMap((s) => s.fields).find((f) => errors[f]);
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }

    setStatus({ kind: 'submitting' });
    try {
      const result = await onboardTenant(toOnboardingInput(values));
      if (result.ok) {
        setStatus({ kind: 'saved', tenant: result.tenant });
        return;
      }
      setStatus({ kind: 'editing' });
      if (result.field) {
        setServerErrors({ [result.field]: result.message });
        focusField(result.field);
      } else {
        setRequestError(result.message);
      }
    } catch (error) {
      setStatus({ kind: 'editing' });
      setRequestError(
        error instanceof Error ? error.message : 'The tenant could not be saved.'
      );
    }
  };

  if (status.kind === 'saved') {
    return <SavedTenant tenant={status.tenant} onAnother={reset} />;
  }

  return (
    <div className="grid gap-800 lg:grid-cols-[1fr_200px]">
      <form
        noValidate
        onSubmit={(event) => void submit(event)}
        aria-busy={submitting}
        className="flex min-w-0 flex-col gap-500"
      >
        {requestError ? (
          <div
            role="alert"
            className="flex items-start gap-300 rounded-xl border border-destructive/30 bg-destructive/5 p-400 text-300 leading-300 text-foreground"
          >
            <CircleAlert aria-hidden className="mt-100-nudge icon-size-300 shrink-0 text-destructive" />
            <div className="flex flex-col gap-100">
              <p className="font-semibold">Tenant not saved</p>
              <p className="text-muted-foreground">{requestError}</p>
            </div>
          </div>
        ) : null}

        <fieldset disabled={submitting} className="contents">
          <Section index={1} id="tenant" title="Tenant" description="The Microsoft Entra tenant whose pipelines you want to monitor.">
            <div className="grid gap-400 md:grid-cols-2">
              <Field
                id="tenant_id"
                label="Tenant ID"
                hint="Directory (tenant) ID from Microsoft Entra, e.g. 00000000-0000-0000-0000-000000000000"
                error={visibleError('tenant_id')}
                className="md:col-span-2"
              >
                <TextInput
                  id="tenant_id"
                  mono
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={MAX_LENGTH.tenant_id}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={values.tenant_id}
                  invalid={!!visibleError('tenant_id')}
                  onChange={(e) => set('tenant_id', e.target.value)}
                  onBlur={() => blur('tenant_id')}
                />
              </Field>
              <Field
                id="tenant_name"
                label="Tenant name"
                hint="A friendly name shown across the monitoring views."
                error={visibleError('tenant_name')}
                className="md:col-span-2"
              >
                <TextInput
                  id="tenant_name"
                  maxLength={MAX_LENGTH.tenant_name}
                  placeholder="Contoso Retail"
                  value={values.tenant_name}
                  invalid={!!visibleError('tenant_name')}
                  onChange={(e) => set('tenant_name', e.target.value)}
                  onBlur={() => blur('tenant_name')}
                />
              </Field>
            </div>
          </Section>

          <Section index={2} id="platform" title="Platform" description="Where this tenant's pipelines run.">
            <div
              role="radiogroup"
              aria-label="Platform"
              aria-invalid={!!visibleError('platform') || undefined}
              aria-describedby={visibleError('platform') ? 'platform-error' : undefined}
              className="grid gap-300 sm:grid-cols-3"
            >
              {PLATFORM_OPTIONS.map((platform) => {
                const Icon = PLATFORM_ICONS[platform.value];
                const selected = values.platform === platform.value;
                return (
                  <label
                    key={platform.value}
                    data-state={selected ? 'checked' : 'unchecked'}
                    className={cn(
                      'group relative flex cursor-pointer flex-col gap-300 rounded-xl border bg-card p-400 transition-[border-color,box-shadow,background-color]',
                      'hover:border-primary/50 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/25',
                      'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60',
                      selected
                        ? 'border-primary bg-accent/60 shadow-xs'
                        : 'border-border',
                      visibleError('platform') && !selected && 'border-destructive/50'
                    )}
                  >
                    <input
                      type="radio"
                      name="platform"
                      value={platform.value}
                      checked={selected}
                      onChange={() => set('platform', platform.value)}
                      onBlur={() => blur('platform')}
                      className="sr-only"
                    />
                    <span className="flex items-center justify-between">
                      <span
                        className={cn(
                          'flex icon-size-600 items-center justify-center rounded-lg transition-colors',
                          selected
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-muted-foreground group-hover:text-foreground'
                        )}
                      >
                        <Icon aria-hidden className="icon-size-200" />
                      </span>
                      <span
                        aria-hidden
                        className={cn(
                          'flex icon-size-300 items-center justify-center rounded-full border transition-colors',
                          selected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-input'
                        )}
                      >
                        {selected ? <Check className="icon-size-100" strokeWidth={3} /> : null}
                      </span>
                    </span>
                    <span className="flex flex-col gap-100">
                      <span className="text-300 leading-300 font-semibold text-foreground">
                        {platform.label}
                      </span>
                      <span className="text-200 leading-200 text-muted-foreground">
                        {platform.hint}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            {visibleError('platform') ? (
              <p id="platform-error" className="mt-200 flex items-center gap-100 text-200 leading-200 text-destructive">
                <CircleAlert aria-hidden className="icon-size-100" />
                {visibleError('platform')}
              </p>
            ) : null}
          </Section>

          <Section
            index={3}
            id="source"
            title="Source location"
            description={
              option
                ? `Where to find the ${option.label} resource.`
                : 'Choose a platform first to see the fields it needs.'
            }
          >
            <div className="grid gap-400 md:grid-cols-2">
              <Field
                id="factory_or_workspace_name"
                label={option?.resourceLabel ?? 'Factory or workspace name'}
                error={visibleError('factory_or_workspace_name')}
                className="md:col-span-2"
              >
                <TextInput
                  id="factory_or_workspace_name"
                  maxLength={MAX_LENGTH.factory_or_workspace_name}
                  placeholder={option?.value === 'Fabric' ? 'Sales Analytics' : 'adf-contoso-prod'}
                  value={values.factory_or_workspace_name}
                  invalid={!!visibleError('factory_or_workspace_name')}
                  onChange={(e) => set('factory_or_workspace_name', e.target.value)}
                  onBlur={() => blur('factory_or_workspace_name')}
                />
              </Field>

              {option?.usesAzureResource ? (
                <>
                  <Field
                    id="subscription_id"
                    label="Subscription ID"
                    optional
                    hint="Azure subscription that holds the resource."
                    error={visibleError('subscription_id')}
                  >
                    <TextInput
                      id="subscription_id"
                      mono
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={MAX_LENGTH.subscription_id}
                      placeholder="xxxxxxxx-xxxx-…"
                      value={values.subscription_id}
                      invalid={!!visibleError('subscription_id')}
                      onChange={(e) => set('subscription_id', e.target.value)}
                      onBlur={() => blur('subscription_id')}
                    />
                  </Field>
                  <Field
                    id="resource_group"
                    label="Resource group"
                    optional
                    error={visibleError('resource_group')}
                  >
                    <TextInput
                      id="resource_group"
                      maxLength={MAX_LENGTH.resource_group}
                      placeholder="rg-data-prod"
                      value={values.resource_group}
                      invalid={!!visibleError('resource_group')}
                      onChange={(e) => set('resource_group', e.target.value)}
                      onBlur={() => blur('resource_group')}
                    />
                  </Field>
                </>
              ) : null}

              {option?.usesFabricWorkspace ? (
                <Field
                  id="fabric_workspace_id"
                  label="Fabric workspace ID"
                  optional
                  hint="Found in the workspace URL after /groups/."
                  error={visibleError('fabric_workspace_id')}
                  className="md:col-span-2"
                >
                  <TextInput
                    id="fabric_workspace_id"
                    mono
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={MAX_LENGTH.fabric_workspace_id}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={values.fabric_workspace_id}
                    invalid={!!visibleError('fabric_workspace_id')}
                    onChange={(e) => set('fabric_workspace_id', e.target.value)}
                    onBlur={() => blur('fabric_workspace_id')}
                  />
                </Field>
              ) : null}
            </div>
          </Section>

          <Section index={4} id="admin" title="Admin contact" optional description="Who to reach about consent and access for this tenant.">
            <div className="grid gap-400 md:grid-cols-2">
              <Field id="admin_name" label="Name" optional error={visibleError('admin_name')}>
                <TextInput
                  id="admin_name"
                  autoComplete="off"
                  maxLength={MAX_LENGTH.admin_name}
                  placeholder="Alex Wilber"
                  value={values.admin_name}
                  invalid={!!visibleError('admin_name')}
                  onChange={(e) => set('admin_name', e.target.value)}
                  onBlur={() => blur('admin_name')}
                />
              </Field>
              <Field id="admin_email" label="Email" optional error={visibleError('admin_email')}>
                <TextInput
                  id="admin_email"
                  type="email"
                  autoComplete="off"
                  maxLength={MAX_LENGTH.admin_email}
                  placeholder="alex@contoso.com"
                  value={values.admin_email}
                  invalid={!!visibleError('admin_email')}
                  onChange={(e) => set('admin_email', e.target.value)}
                  onBlur={() => blur('admin_email')}
                />
              </Field>
            </div>
          </Section>

          <Section index={5} id="schedule" title="Ingestion schedule" description="How often pipeline runs are pulled for this tenant.">
            <Field
              id="refresh_interval"
              label="Refresh interval"
              hint="In minutes. Pick a preset or enter your own."
              error={visibleError('refresh_interval')}
            >
              <div className="flex flex-wrap items-center gap-300">
                <div className="relative w-40">
                  <TextInput
                    id="refresh_interval"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={values.refresh_interval}
                    invalid={!!visibleError('refresh_interval')}
                    onChange={(e) => set('refresh_interval', e.target.value)}
                    onBlur={() => blur('refresh_interval')}
                    className="pr-800"
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 right-300 flex items-center text-200 text-muted-foreground"
                  >
                    min
                  </span>
                </div>
                <div role="group" aria-label="Refresh presets" className="flex flex-wrap gap-200">
                  {REFRESH_PRESETS.map((preset) => {
                    const active = values.refresh_interval.trim() === String(preset.minutes);
                    return (
                      <button
                        key={preset.minutes}
                        type="button"
                        aria-pressed={active}
                        onClick={() => set('refresh_interval', String(preset.minutes))}
                        className={cn(
                          'h-8 rounded-full border px-300 text-[length:var(--text-200)] font-medium transition-colors',
                          'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30',
                          active
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-input bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Field>
          </Section>
        </fieldset>

        <div className="sticky bottom-0 -mx-100 flex items-center justify-between gap-300 border-t border-border bg-background/90 px-100 py-400 backdrop-blur">
          <p className="hidden text-200 leading-200 text-muted-foreground sm:block">
            New tenants are saved as active with the refresh interval you set.
          </p>
          <div className="ml-auto flex items-center gap-200">
            <Button variant="ghost" onClick={reset} disabled={submitting}>
              <RotateCcw aria-hidden className="icon-size-200" />
              Clear
            </Button>
            <Button type="submit" disabled={submitting} className="min-w-40">
              {submitting ? (
                <>
                  <LoaderCircle aria-hidden className="icon-size-200 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  Onboard tenant
                  <ArrowRight aria-hidden className="icon-size-200" />
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      <ReadinessRail sections={SECTIONS} ready={sectionReady} />
    </div>
  );
}

function Section({
  index,
  id,
  title,
  description,
  optional,
  children,
}: {
  index: number;
  id: SectionId;
  title: string;
  description: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={`section-${id}`}
      aria-labelledby={`section-${id}-title`}
      className="scroll-mt-600 rounded-2xl border border-border bg-card p-600 shadow-[var(--shadow-card)]"
    >
      <header className="mb-500 flex items-start gap-400">
        <span className="font-monospace text-200 leading-300 font-medium text-primary">
          {String(index).padStart(2, '0')}
        </span>
        <div className="flex flex-col gap-100">
          <h2
            id={`section-${id}-title`}
            className="flex items-center gap-200 font-heading text-500 leading-500 font-semibold text-card-foreground"
          >
            {title}
            {optional ? (
              <span className="rounded-full bg-secondary px-200 py-100-nudge font-base text-200 leading-200 font-medium text-muted-foreground">
                Optional
              </span>
            ) : null}
          </h2>
          <p className="text-300 leading-300 text-muted-foreground">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function ReadinessRail({
  sections,
  ready,
}: {
  sections: typeof SECTIONS;
  ready: (id: SectionId) => boolean;
}) {
  return (
    <nav aria-label="Form progress" className="hidden lg:block">
      <ol className="sticky top-600 flex flex-col">
        {sections.map((section, i) => {
          const done = ready(section.id);
          return (
            <li key={section.id} className="relative flex gap-300 pb-500 last:pb-0">
              {i < sections.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    'absolute left-[calc(var(--icon-size-300)/2)] top-500 h-[calc(100%-var(--spacing-500))] w-px',
                    done ? 'bg-primary/60' : 'bg-border'
                  )}
                />
              ) : null}
              <span
                aria-hidden
                className={cn(
                  'relative flex icon-size-300 shrink-0 items-center justify-center rounded-full border transition-colors',
                  done
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-card'
                )}
              >
                {done ? <Check className="icon-size-100" strokeWidth={3} /> : null}
              </span>
              <a
                href={`#section-${section.id}`}
                className="-mt-100-nudge flex flex-col rounded-md text-300 leading-300 text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                <span className={done ? 'font-medium' : undefined}>{section.title}</span>
                <span className="text-200 leading-200 text-muted-foreground">
                  {done ? (section.optional ? 'Looks good' : 'Ready') : section.optional ? 'Optional' : 'Needs details'}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function SavedTenant({
  tenant,
  onAnother,
}: {
  tenant: Extract<OnboardTenantResult, { ok: true }>['tenant'];
  onAnother: () => void;
}) {
  const platform = platformOption(tenant.platform);
  const Icon = PLATFORM_ICONS[tenant.platform] ?? Layers;
  return (
    <section
      aria-labelledby="saved-title"
      className="mx-auto flex max-w-xl flex-col items-center gap-500 rounded-2xl border border-border bg-card p-800 text-center shadow-[var(--shadow-card)]"
    >
      <span className="flex icon-size-700 items-center justify-center rounded-full bg-accent text-primary">
        <CircleCheck aria-hidden className="icon-size-500" />
      </span>
      <div className="flex flex-col gap-200">
        <h2 id="saved-title" className="font-heading text-hero-700 leading-hero-700 font-semibold">
          Tenant onboarded
        </h2>
        <p className="text-300 leading-300 text-muted-foreground">
          {tenant.tenant_name} is saved to the tenant configuration and marked active.
        </p>
      </div>
      <dl className="grid w-full gap-300 rounded-xl bg-secondary p-400 text-left text-300 leading-300">
        <div className="flex items-center justify-between gap-400">
          <dt className="text-muted-foreground">Platform</dt>
          <dd className="flex items-center gap-200 font-medium">
            <Icon aria-hidden className="icon-size-200 text-primary" />
            {platform?.label ?? tenant.platform}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-400">
          <dt className="text-muted-foreground">Tenant ID</dt>
          <dd className="truncate font-monospace text-200">{tenant.id}</dd>
        </div>
      </dl>
      <Button onClick={onAnother}>Onboard another tenant</Button>
    </section>
  );
}
