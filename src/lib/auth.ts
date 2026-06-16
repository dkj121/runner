import { betterAuth } from "better-auth";

export const auth = betterAuth({
	appname: process.env.APP_NAME,
	baseURL: process.env.BETTER_AUTH_URL,
	emailAndPassword: {
		enabled: true,
	},
});
