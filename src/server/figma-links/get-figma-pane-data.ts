"use server";

import { listSpecFigmaLinks } from "./list-spec-figma-links";
import { getFigmaCoverage } from "./get-figma-coverage";
import type { FigmaPaneData } from "./types";

/**
 * 가운데 "디자인 프레임" 뷰의 client 컴포넌트가 한 round-trip 으로 가져가는 묶음.
 * specId 가 빈 문자열이거나 유효하지 않은 경우 빈 결과를 반환한다.
 */
export async function getFigmaPaneData(specId: string): Promise<FigmaPaneData> {
  if (!specId) {
    return {
      links: [],
      coverage: {
        total: 0,
        byLevel: { required: 0, recommended: 0, optional: 0, not_needed: 0 },
        expectedCount: 0,
        connectedCount: 0,
      },
    };
  }
  const [links, coverage] = await Promise.all([
    listSpecFigmaLinks(specId),
    getFigmaCoverage(specId),
  ]);
  return { links, coverage };
}
