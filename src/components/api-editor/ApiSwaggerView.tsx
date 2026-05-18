"use client";

import { useMemo } from "react";
// @ts-expect-error swagger-ui-react 는 타입 정의가 없거나 부분적임.
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import YAML from "yaml";

interface Props {
  apiSpec: string;
}

/**
 * OpenAPI YAML/JSON 을 Swagger UI 로 렌더 (D-040).
 * - YAML 파싱 실패 시 에러 메시지 표시 (편집 중 깨진 상태일 수 있음).
 * - 빈 본문이면 안내.
 */
export function ApiSwaggerView({ apiSpec }: Props) {
  const { parsed, error } = useMemo(() => {
    const trimmed = apiSpec.trim();
    if (!trimmed) return { parsed: null, error: null };
    try {
      const obj = YAML.parse(trimmed);
      if (!obj || typeof obj !== "object") {
        return { parsed: null, error: "OpenAPI 문서 최상위는 객체여야 합니다." };
      }
      return { parsed: obj as Record<string, unknown>, error: null };
    } catch (e) {
      return {
        parsed: null,
        error: e instanceof Error ? e.message : "YAML 파싱 실패",
      };
    }
  }, [apiSpec]);

  if (!apiSpec.trim()) {
    return (
      <div className="rounded-md border border-dashed border-zinc-200 px-4 py-10 text-center text-xs text-zinc-500 dark:border-zinc-700">
        편집 탭에서 OpenAPI 명세를 작성하세요.
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        <strong>YAML 파싱 실패</strong>
        <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px]">
          {error}
        </pre>
      </div>
    );
  }

  return (
    <div
      id="api-swagger-root"
      className="api-swagger-host rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
    >
      <SwaggerUI spec={parsed} />
    </div>
  );
}
