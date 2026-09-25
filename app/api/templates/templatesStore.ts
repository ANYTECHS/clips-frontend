import { randomUUID } from "crypto";
import type { TemplateSettings } from "@/app/api/schemas/templates.schema";

export interface TemplateVersion {
  version: number;
  name: string;
  description: string;
  settings: TemplateSettings;
  sharedWithTeam: boolean;
  createdAt: string;
  createdBy: string;
}

export interface ClipTemplate extends TemplateVersion {
  id: string;
  ownerId: string | null;
  teamId: string | null;
  isPreset: boolean;
  updatedAt: string;
}

export interface TemplateScope {
  userId: string;
  teamId: string | null;
}

const PRESET_DATE = "2026-01-01T00:00:00.000Z";

function preset(
  id: string,
  name: string,
  description: string,
  settings: TemplateSettings
): ClipTemplate {
  return {
    id,
    ownerId: null,
    teamId: null,
    isPreset: true,
    name,
    description,
    settings,
    sharedWithTeam: true,
    version: 1,
    createdAt: PRESET_DATE,
    updatedAt: PRESET_DATE,
    createdBy: "clipcash",
  };
}

export const TEMPLATE_PRESETS: ClipTemplate[] = [
  preset("preset-vertical-viral", "Vertical Viral", "Fast-paced 9:16 clips with bold captions.", {
    aspectRatio: "9:16",
    durationSeconds: 30,
    style: "Bold & Dynamic",
    transformStyle: null,
    transformOptions: {},
  }),
  preset("preset-clean-tutorial", "Clean Tutorial", "A calm 16:9 layout for educational content.", {
    aspectRatio: "16:9",
    durationSeconds: 60,
    style: "Minimalist",
    transformStyle: null,
    transformOptions: {},
  }),
  preset(
    "preset-social-square",
    "Social Square",
    "A balanced square format for multi-platform posts.",
    {
      aspectRatio: "1:1",
      durationSeconds: 45,
      style: "Subtitles Only",
      transformStyle: null,
      transformOptions: {},
    }
  ),
];

function clone<T>(value: T): T {
  return structuredClone(value);
}

interface StoredTemplate extends ClipTemplate {
  history: TemplateVersion[];
}

/**
 * Safe API shape. Internal team scope is omitted so authorization boundaries
 * are never exposed to clients; `canEdit` tells the UI whether this caller may
 * mutate the record.
 */
export interface TemplateResponse extends Omit<ClipTemplate, "teamId"> {
  canEdit: boolean;
}

function publicTemplate(template: StoredTemplate, scope: TemplateScope): TemplateResponse {
  const source = clone(template);
  return {
    id: source.id,
    ownerId: source.ownerId,
    isPreset: source.isPreset,
    name: source.name,
    description: source.description,
    settings: source.settings,
    sharedWithTeam: source.sharedWithTeam,
    version: source.version,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
    createdBy: source.createdBy,
    canEdit: !source.isPreset && source.ownerId === scope.userId,
  };
}

class TemplatesStore {
  private templates: StoredTemplate[] = clone(TEMPLATE_PRESETS) as StoredTemplate[];

  reset(): void {
    this.templates = clone(TEMPLATE_PRESETS) as StoredTemplate[];
  }

  list(scope: TemplateScope): TemplateResponse[] {
    return this.templates
      .filter((template) => this.canRead(template, scope))
      .sort((a, b) => {
        if (a.isPreset !== b.isPreset) return a.isPreset ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      })
      .map((template) => publicTemplate(template, scope));
  }

  get(id: string, scope: TemplateScope): TemplateResponse | undefined {
    const template = this.templates.find((candidate) => candidate.id === id);
    if (!template || !this.canRead(template, scope)) return undefined;
    return publicTemplate(template, scope);
  }

  getVersion(id: string, version: number, scope: TemplateScope): TemplateVersion | undefined {
    const template = this.templates.find((candidate) => candidate.id === id);
    if (!template || !this.canRead(template, scope) || version < 1) {
      return undefined;
    }
    if (version === template.version) return this.toVersion(template);
    if (template.isPreset) return undefined;
    return template.history.find((entry) => entry.version === version);
  }

  create(
    input: {
      name: string;
      description: string;
      settings: TemplateSettings;
      sharedWithTeam: boolean;
    },
    scope: TemplateScope
  ): TemplateResponse {
    const now = new Date().toISOString();
    const template: StoredTemplate = {
      id: `template_${randomUUID().replace(/-/g, "")}`,
      ownerId: scope.userId,
      teamId: scope.teamId,
      isPreset: false,
      name: input.name,
      description: input.description,
      settings: clone(input.settings),
      sharedWithTeam: input.sharedWithTeam,
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: scope.userId,
      history: [],
    };
    this.templates.unshift(template);
    return publicTemplate(template, scope);
  }

  update(
    id: string,
    expectedVersion: number,
    input: Partial<Pick<ClipTemplate, "name" | "description" | "settings" | "sharedWithTeam">>,
    scope: TemplateScope
  ):
    { status: "not-found" | "forbidden" | "conflict" | "preset" } | { template: TemplateResponse } {
    const template = this.templates.find((candidate) => candidate.id === id);
    if (!template || !this.canRead(template, scope)) return { status: "not-found" };
    if (template.isPreset) return { status: "preset" };
    if (template.ownerId !== scope.userId) return { status: "forbidden" };
    if (template.version !== expectedVersion) return { status: "conflict" };

    const snapshot = this.toVersion(template);
    template.name = input.name ?? template.name;
    template.description = input.description ?? template.description;
    template.settings = input.settings ? clone(input.settings) : template.settings;
    template.sharedWithTeam = input.sharedWithTeam ?? template.sharedWithTeam;
    template.version += 1;
    template.updatedAt = new Date().toISOString();
    template.history = [...template.history, snapshot].slice(-20);
    return { template: publicTemplate(template, scope) };
  }

  delete(id: string, scope: TemplateScope): "deleted" | "not-found" | "forbidden" | "preset" {
    const index = this.templates.findIndex((template) => template.id === id);
    if (index === -1) return "not-found";
    const template = this.templates[index];
    if (!this.canRead(template, scope)) return "not-found";
    if (template.isPreset) return "preset";
    if (template.ownerId !== scope.userId) return "forbidden";
    this.templates.splice(index, 1);
    return "deleted";
  }

  /** Resolve a template for application to an upload without exposing history. */
  getSettings(
    id: string,
    scope: TemplateScope
  ): { settings: TemplateSettings; version: number } | undefined {
    const template = this.get(id, scope);
    return template ? { settings: clone(template.settings), version: template.version } : undefined;
  }

  private canRead(template: ClipTemplate, scope: TemplateScope): boolean {
    return (
      template.isPreset ||
      template.ownerId === scope.userId ||
      Boolean(scope.teamId && template.teamId === scope.teamId && template.sharedWithTeam)
    );
  }

  private toVersion(template: ClipTemplate): TemplateVersion {
    return {
      version: template.version,
      name: template.name,
      description: template.description,
      settings: clone(template.settings),
      sharedWithTeam: template.sharedWithTeam,
      createdAt: template.updatedAt,
      createdBy: template.ownerId ?? "clipcash",
    };
  }
}

export const templatesStore = new TemplatesStore();
