import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
	plugins: [emailOTPClient()],
	fetchOptions: {
		timeout: 15_000,
	},
});

export const { signIn, signOut, signUp, useSession } = authClient;
