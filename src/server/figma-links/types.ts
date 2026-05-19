import type { FigmaRequiredLevel } from "@/generated/prisma/enums";

export interface SpecFigmaLinkItem {
  id: string;
  requiredLevel: FigmaRequiredLevel;
  order: number;
  frame: {
    id: string;
    fileKey: string;
    nodeId: string;
    label: string;
  };
}

export interface FigmaCoverage {
  total: number;
  byLevel: Record<FigmaRequiredLevel, number>;
  expectedCount: number;
  connectedCount: number;
}

export interface FigmaPaneData {
  links: SpecFigmaLinkItem[];
  coverage: FigmaCoverage;
}
