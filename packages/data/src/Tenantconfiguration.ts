// ---------------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//     Copyright (c) Microsoft Corporation. All rights reserved.
//     Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
// ---------------------------------------------------------------------------

import { authenticated, entity, uuid, text, date, set, int, boolean, many } from '@microsoft/rayfin-core';
import { Workspace }   from './Workspace.js';
import { Item }        from './Item.js';
import { JobInstance } from './Jobinstance.js';
import { ActivityRun } from './Activityrun.js';

/**
 * TenantConfiguration — control/config table (Layer 0).
 *
 * ⚡ id = tenant_id UUID (supplied from raw zone, NOT auto-generated).
 *    PySpark transform writes the AAD tenant GUID as this entity's id.
 *    Child tables (Workspace, Item, JobInstance, ActivityRun) reference
 *    this id via their tenant_id FK field (@uuid).
 */
@entity()
@authenticated('*')
export class TenantConfiguration {
  /** Supplied = AAD tenant GUID from raw zone. */
  @uuid() id!: string;

  // ── Tenant info ───────────────────────────────────────────────────────────────
  @text({ max: 200 }) tenant_name!: string;

  @set('AzureDataFactory', 'AzureSynapse', 'Fabric')
  platform!: 'AzureDataFactory' | 'AzureSynapse' | 'Fabric';

  @text({ max: 64, optional: true })  subscription_id?: string;
  @text({ max: 200, optional: true }) resource_group?: string;
  @text({ max: 200 })                 factory_or_workspace_name!: string;
  @text({ max: 64, optional: true })  fabric_workspace_id?: string;

  // ── Admin contact ─────────────────────────────────────────────────────────────
  @text({ max: 200, optional: true }) admin_name?: string;
  @text({ max: 320, optional: true }) admin_email?: string;

  // ── Consent tracking ──────────────────────────────────────────────────────────
  @text({ max: 1000, optional: true }) consent_url?: string;
  @text({ max: 50, optional: true })   consent_status?: string;   // Pending|Sent|Granted|Revoked
  @date({ optional: true })            consent_sent_at?: Date;
  @date({ optional: true })            consent_granted_at?: Date;

  // ── Ingestion control ─────────────────────────────────────────────────────────
  @int({ min: 1 })                    refresh_interval!: number;
  @boolean()                          is_active!: boolean;
  @text({ max: 50, optional: true })  last_sync_status?: string;  // Succeeded|Failed|Running
  @date({ optional: true })           last_sync_time?: Date;
  @date({ optional: true })           onboarded_at?: Date;

  // ── Relationships (parent side) ───────────────────────────────────────────────
  @many(() => Workspace)   workspaces?:   Workspace[];
  @many(() => Item)        items?:        Item[];
  @many(() => JobInstance) jobInstances?: JobInstance[];
  @many(() => ActivityRun) activityRuns?: ActivityRun[];

  // ── Audit ─────────────────────────────────────────────────────────────────────
  @date() created_at!: Date;
  @date() updated_at!: Date;
}