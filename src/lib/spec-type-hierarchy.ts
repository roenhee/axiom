import type { SpecType } from "@/generated/prisma/enums";

/**
 * SpecType 위계 — 작을수록 상위 단위 (D-035).
 *
 *   FeatureGroup(0) > Feature(1) > Component(2) ≈ State(3)
 *
 * 룰: 자식 type 은 부모 type 보다 같거나 하위 위계만 가능.
 * 즉 Component 안에 Feature 를 넣을 수 없다 (작은 단위 안에 큰 단위 금지).
 */
export const SPEC_TYPE_RANK: Record<SpecType, number> = {
  FeatureGroup: 0,
  Feature: 1,
  Component: 2,
  State: 3,
};

export function isChildTypeAllowed(
  parentType: SpecType,
  childType: SpecType,
): boolean {
  return SPEC_TYPE_RANK[childType] >= SPEC_TYPE_RANK[parentType];
}

/**
 * 사람이 읽는 거부 메시지.
 */
export function childTypeRejectionReason(
  parentType: SpecType,
  childType: SpecType,
): string {
  return `${childType} 은 ${parentType} 보다 상위 위계라 안쪽으로 넣을 수 없습니다.`;
}
