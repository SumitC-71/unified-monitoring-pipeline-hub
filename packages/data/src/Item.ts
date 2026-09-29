// ---------------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//     Copyright (c) Microsoft Corporation. All rights reserved.
//     Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
// ---------------------------------------------------------------------------

import { authenticated, entity, uuid, text, date, set, one, many } from '@microsoft/rayfin-core';
import { TenantConfiguration } from './Tenantconfiguration.js';
import { Workspace }   from './Workspace.js';
import { JobInstance } from './Jobinstance.js';

/**
 * Item (pipelines) — Layer 2 SQL table.
 *
 * ⚡ id = item_id UUID (supplied from raw zone, NOT auto-generated).
 *    Fabric → GUID item ID | ADF → pipeline name (bug, handle later).
 *    Child tables (JobInstance, ActivityRun) reference this via item_id FK (@uuid).
 */
@entity()
@authenticated('*')
export class Item {
  /** Supplied = platform item/pipeline GUID from raw zone. */
  @uuid() id!: string;

  // ── FK → TenantConfiguration ──────────────────────────────────────────────────
  /** FK → TenantConfiguration.id (AAD tenant GUID). SQL: @uuid, insert-only. */
  @uuid() tenant_id!: string;
  @one(() => TenantConfiguration) tenant?: TenantConfiguration;

  // ── FK → Workspace ────────────────────────────────────────────────────────────
  /** FK → Workspace.id (platform workspace GUID). SQL: @uuid, insert-only. */
  @uuid() workspace_id!: string;
  @one(() => Workspace) workspace?: Workspace;

  // ── Fields ────────────────────────────────────────────────────────────────────
  @set('AzureDataFactory', 'AzureSynapse', 'Fabric')
  platform!: 'AzureDataFactory' | 'AzureSynapse' | 'Fabric';

  @text({ max: 200 })                display_name!: string;
  @text({ optional: true })          description?: string;
  @text({ max: 50, optional: true }) type?: string;       // "DataPipeline" (Fabric) | "Pipeline" (ADF)
  @text({ max: 64, optional: true }) folder_id?: string;

  // ── Relationships (parent side) ───────────────────────────────────────────────
  @many(() => JobInstance) jobInstances?: JobInstance[];

  // ── Audit ─────────────────────────────────────────────────────────────────────
  @date() created_at!: Date;
  @date() updated_at!: Date;
}