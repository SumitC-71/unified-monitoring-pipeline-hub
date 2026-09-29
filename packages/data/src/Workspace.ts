// ---------------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//     Copyright (c) Microsoft Corporation. All rights reserved.
//     Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
// ---------------------------------------------------------------------------

import { authenticated, entity, uuid, text, date, set, one, many } from '@microsoft/rayfin-core';
import { TenantConfiguration } from './Tenantconfiguration.js';
import { Item }        from './Item.js';
import { JobInstance } from './Jobinstance.js';

/**
 * Workspace — Layer 2 SQL table.
 *
 * ⚡ id = workspace_id UUID (supplied from raw zone, NOT auto-generated).
 *    PySpark transform writes the platform workspace GUID as this entity's id.
 *    Child tables (Item, JobInstance, ActivityRun) reference this via workspace_id FK (@uuid).
 */
@entity()
@authenticated('*')
export class Workspace {
  /** Supplied = platform workspace GUID from raw zone. */
  @uuid() id!: string;

  // ── FK → TenantConfiguration ──────────────────────────────────────────────────
  /** FK → TenantConfiguration.id (AAD tenant GUID). SQL: @uuid, insert-only. */
  @uuid() tenant_id!: string;
  @one(() => TenantConfiguration) tenant?: TenantConfiguration;

  // ── Fields ────────────────────────────────────────────────────────────────────
  @set('AzureDataFactory', 'AzureSynapse', 'Fabric')
  platform!: 'AzureDataFactory' | 'AzureSynapse' | 'Fabric';

  @text({ max: 200 })             display_name!: string;
  @text({ optional: true })       description?: string;
  @text({ max: 50, optional: true }) type?: string;
  @text({ max: 64, optional: true }) capacity_id?: string;

  // ── Relationships (parent side) ───────────────────────────────────────────────
  @many(() => Item)        items?:        Item[];
  @many(() => JobInstance) jobInstances?: JobInstance[];

  // ── Audit ─────────────────────────────────────────────────────────────────────
  @date() created_at!: Date;
  @date() updated_at!: Date;
}