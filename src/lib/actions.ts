"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export type OtpPurpose = "sign-in" | "email-verification" | "forget-password";

export async function resendOtp(email: string, type: OtpPurpose) {
	const normalizedEmail = email.trim().toLowerCase();
	if (!normalizedEmail) {
		return { success: false, error: "请输入邮箱地址。" };
	}

	try {
		await auth.api.sendVerificationOTP({
			body: { email: normalizedEmail, type },
		});
		return { success: true, error: null };
	} catch {
		return { success: false, error: "验证码发送失败，请稍后重试。" };
	}
}

export async function checkSession() {
	return auth.api.getSession({ headers: await headers() });
}
