// ---------------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//     Copyright (c) Microsoft Corporation. All rights reserved.
//     Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
// ---------------------------------------------------------------------------

import { authenticated, entity, uuid, text, date, set, int, boolean, many } from '@microsoft/rayfin-core';
import { Workspace } from './Workspace.js';

/**
 * TenantConfiguration — Layer 0 control table (one row per guest tenant).
 *
 * id = AAD tenant GUID supplied by the user in the Config Form.
 * This is the natural unique identifier for a tenant — no surrogate needed.
 *
 * Platform and subscription details do NOT live here.
 * They live in the Workspace table, which is populated by discovery notebooks.
 * One tenant → many Workspaces (across ADF, Synapse, Fabric).
 *
 * Consent is tenant-level (admin consent covers all platforms for that tenant).
 */
@entity()
@authenticated('*')
export class TenantConfiguration {
  /**
   * AAD tenant GUID — supplied by the user in the Config Form.
   * Uniquely identifies the guest organization across all platforms.
   */
  @uuid() id!: string;

  // ── Tenant identity ────────────────────────────────────────────────────────────
  @text({ max: 200 }) tenant_name!: string;

  // ── Admin contact ──────────────────────────────────────────────────────────────
  @text({ max: 200, optional: true }) admin_name?: string;

  /**
   * Guest tenant admin's email.
   * The Admin Consent URL is sent directly to this address.
   */
  @text({ max: 320, optional: true }) admin_email?: string;

  // ── Consent tracking (tenant-level — one consent covers all platforms) ─────────
  /**
   * Generated consent link for this tenant.
   * Format: https://login.microsoftonline.com/{id}/adminconsent?client_id={our_app_client_id}
   * Stored at onboarding time.
   */
  @text({ max: 1000, optional: true }) consent_url?: string;

  @set({ optional: true }, 'Pending', 'Sent', 'Granted', 'Revoked')
  consent_status?: 'Pending' | 'Sent' | 'Granted' | 'Revoked';

  /** When the consent URL was emailed to admin_email. */
  @date({ optional: true }) consent_sent_at?: Date;

  /** Set once SP access is confirmed enabled in the guest tenant. */
  @date({ optional: true }) consent_granted_at?: Date;

  // ── Ingestion control ──────────────────────────────────────────────────────────
  /** Default minutes between ingestion runs — applies across all workspaces for this tenant. */
  @int({ min: 1 }) refresh_interval!: number;

  /** Master toggle — disables ingestion for all workspaces under this tenant. */
  @boolean() is_active!: boolean;

  @set({ optional: true }, 'Succeeded', 'Failed', 'Running')
  last_sync_status?: 'Succeeded' | 'Failed' | 'Running';

  @date({ optional: true }) last_sync_time?: Date;
  @date({ optional: true }) onboarded_at?: Date;

  // ── Submitted by (signed-in user who filled the onboarding form) ───────────────
  /** Auth session user ID (JWT sub claim). */
  @text({ max: 200, optional: true }) submitted_by?: string;
  @text({ max: 320, optional: true }) submitted_by_email?: string;

  // ── Relationships ──────────────────────────────────────────────────────────────
  /**
   * All workspaces discovered across all platforms for this tenant.
   * Populated by ingestion notebooks — not entered by the user.
   */
  @many(() => Workspace) workspaces?: Workspace[];

  // ── Audit ──────────────────────────────────────────────────────────────────────
  @date() created_at!: Date;
  @date() updated_at!: Date;
}