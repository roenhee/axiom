import path from "node:path";
import type { NextConfig } from "next";

/**
 * D-044. Turbopack 의 workspace root 를 이 디렉토리로 고정한다.
 * worktree 가 메인 레포 안 (`.claude/worktrees/...`) 에 위치하면 lockfile 이 두 개로
 * 보이고, Next 의 자동 추론이 상위 디렉토리를 root 로 잡아 file watcher 가 메인 레포의
 * node_modules / .next 까지 감시해서 CPU 가 튄다. 명시적으로 박아둠.
 */
const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
