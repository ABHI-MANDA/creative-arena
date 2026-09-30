import { KIND_LABELS, PLATFORMS } from "./presets";

export type CustomAdTemplate = {
  id: string;
  name: string;
  kind: string;
  platforms: string[];
  instructions: string;
  createdAt: string;
};

export type TemplateLibrary = {
  enabledKinds: string[];
  customTemplates: CustomAdTemplate[];
};

export const TEMPLATE_LIBRARY_KEY = "template-library";
export const DEFAULT_TEMPLATE_LIBRARY: TemplateLibrary = {
  enabledKinds: Object.keys(KIND_LABELS).filter((kind) => kind !== "copy"),
  customTemplates: [],
};

export const SUPPORTED_TEMPLATE_KINDS = Object.keys(KIND_LABELS).filter((kind) => kind !== "copy");
export const SUPPORTED_TEMPLATE_PLATFORMS = PLATFORMS.map((platform) => platform.id);
