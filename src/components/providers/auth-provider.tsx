"use client";

import { createContext, useContext, type ReactNode } from "react";

import { useSession } from "@/lib/auth-client";

type AuthState = ReturnType<typeof useSession>;

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const session = useSession();

	return (
		<AuthContext.Provider value={session}>{children}</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within AuthProvider");
	}
	return context;
}
