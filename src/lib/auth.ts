import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import { after } from "next/server";

import { prisma } from "./prisma";

export const auth = betterAuth({
	database: prismaAdapter(prisma, {
		provider: "mysql",
	}),

	secret: process.env.BETTER_AUTH_SECRET,

	baseURL: process.env.BETTER_AUTH_URL,

	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
	},
	emailVerification: {
		autoSignInAfterVerification: true,
	},

	plugins: [
		emailOTP({
			sendVerificationOnSignUp: true,
			overrideDefaultEmailVerification: true,
			storeOTP: "hashed",
			sendVerificationOTP(data) {
				after(async () => {
					try {
						await sendOtpEmail(data);
					} catch (error) {
						console.error("Failed to send authentication OTP email", error);
					}
				});
				return Promise.resolve();
			},
		}),
	],
});

async function sendOtpEmail({
	email,
	otp,
	type,
}: {
	email: string;
	otp: string;
	type: "sign-in" | "email-verification" | "forget-password" | "change-email";
}) {
	const apiKey = process.env.RESEND_API_KEY;
	if (!apiKey) throw new Error("RESEND_API_KEY is not configured");

	const subject =
		type === "forget-password"
			? "重置你的 Runner 密码"
			: "验证你的 Runner 邮箱";
	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from: process.env.RESEND_FROM_EMAIL ?? "Runner <onboarding@resend.dev>",
			to: [email],
			subject,
			html: `<div style="font-family: sans-serif; color: #171717"><h2>${subject}</h2><p>你的 6 位验证码是：</p><p style="font-size: 32px; font-weight: 700; letter-spacing: 8px">${otp}</p><p>验证码 5 分钟内有效。若非本人操作，请忽略此邮件。</p></div>`,
		}),
		signal: AbortSignal.timeout(10_000),
	});

	if (!response.ok) {
		throw new Error(`Resend failed with status ${response.status}`);
	}
}
