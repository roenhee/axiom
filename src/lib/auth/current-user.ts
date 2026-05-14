import { db } from "@/lib/db";
import type { User } from "@/generated/prisma/client";

/**
 * 현재 요청의 user를 반환한다.
 *
 * 사내 SSO 붙기 전까지는 .env의 DEV_USER_EMAIL 에 해당하는 seed user를 항상 반환한다
 * (CLAUDE.md "로그인 우회 전략 A", docs/decisions.md D-010).
 *
 * SSO 붙는 시점에 이 함수의 본문만 갈아끼우면 호출처는 그대로 둔다.
 */
export async function getCurrentUser(): Promise<User> {
  const email = process.env.DEV_USER_EMAIL;
  if (!email) {
    throw new Error(
      "DEV_USER_EMAIL 환경변수가 비어 있다. .env.example 참고하여 .env 채울 것.",
    );
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(
      `Dev user(${email})가 DB에 없다. 'npm run seed' 실행해서 만들 것.`,
    );
  }
  return user;
}

/**
 * Server Action / API route 안에서 user id만 빠르게 필요할 때 사용.
 */
export async function getCurrentUserId(): Promise<string> {
  const user = await getCurrentUser();
  return user.id;
}
