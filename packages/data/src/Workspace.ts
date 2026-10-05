// ---------------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//     Copyright (c) Microsoft Corporation. All rights reserved.
//     Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
// ---------------------------------------------------------------------------

import { authenticated, entity, uuid, text, date, set, boolean, one, many } from '@microsoft/rayfin-core';
import { TenantConfiguration } from './Tenantconfiguration.js';
import { Item }        from './Item.js';
import { JobInstance } from './Jobinstance.js';

/**
 * Workspace — Layer 2 SQL table (auto-discovered by ingestion notebooks).
 *
 * One row = one factory or workspace discovered for a tenant:
 *   ADF     : one ADF factory     (id synthesized as "{subscription_id}/{resource_group}/{factory_name}")
 *   Synapse : one Synapse workspace
 *   Fabric  : one Fabric workspace GUID
 *
 * Platform and subscription details live here — NOT in TenantConfiguration.
 * Rows are written by the ingestion notebook on discovery, not entered by the user.
 *
 * ⚡ id = platform workspace GUID (supplied from raw zone, NOT auto-generated).
 *    Child tables (Item, JobInstance) reference this via workspace_id FK.
 */
@entity()
@authenticated('*')
export class Workspace {
  /**
   * Platform workspace GUID (supplied, not auto-generated).
   * ADF     : synthesized as "{subscription_id}/{resource_group}/{factory_name}".
   * Synapse / Fabric : native GUID from the platform API.
   */
  @uuid() id!: string;

  // ── FK → TenantConfiguration ───────────────────────────────────────────────────
  /**
   * FK → TenantConfiguration.id (AAD tenant GUID).
   * Direct reference — TenantConfiguration.id IS the AAD GUID supplied by the user.
   */
  @uuid() tenant_id!: string;
  @one(() => TenantConfiguration) tenant?: TenantConfiguration;

  // ── Platform & source details (moved from TenantConfiguration) ─────────────────
  @set('AzureDataFactory', 'AzureSynapse', 'Fabric')
  platform!: 'AzureDataFactory' | 'AzureSynapse' | 'Fabric';

  /**
   * Azure subscription ID.
   * Required for ADF and Synapse; null for Fabric.
   */
  @text({ max: 64, optional: true }) subscription_id?: string;

  /**
   * Azure resource group.
   * Required for ADF and Synapse; null for Fabric.
   */
  @text({ max: 200, optional: true }) resource_group?: string;

  // ── Workspace fields ───────────────────────────────────────────────────────────
  @text({ max: 200 })                display_name!: string;
  @text({ optional: true })          description?: string;
  @text({ max: 50,  optional: true }) type?: string;
  @text({ max: 64,  optional: true }) capacity_id?: string;

  /**
   * Operational toggle — pause ingestion for this workspace without deregistering it.
   * Default: true — all discovered workspaces are monitored automatically.
   * NOT a security boundary; the SP retains access regardless of this flag.
   */
  @boolean({ default: true }) is_active!: boolean;

  /** Timestamp of the first discovery run that surfaced this workspace. */
  @date({ optional: true }) first_discovered_at?: Date;

  // ── Relationships (parent side) ────────────────────────────────────────────────
  @many(() => Item)        items?:        Item[];
  @many(() => JobInstance) jobInstances?: JobInstance[];

  // ── Audit ──────────────────────────────────────────────────────────────────────
  @date() created_at!: Date;
  @date() updated_at!: Date;
}