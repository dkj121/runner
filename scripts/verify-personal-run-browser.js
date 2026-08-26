/* eslint-disable @typescript-eslint/no-unused-expressions */
async (page) => {
	const state = {
		created: 0,
		points: 0,
		events: [],
		pending: 0,
		completed: 0,
		deleted: 0,
		documentFailures: [],
	};
	page.on("response", (response) => {
		if (
			response.request().resourceType() === "document" &&
			response.status() >= 500
		) {
			state.documentFailures.push({
				url: response.url(),
				status: response.status(),
			});
		}
	});
	await page.context().grantPermissions(["geolocation"]);
	await page.context().setGeolocation({ latitude: 32.041, longitude: 118.784 });
	await page.context().addCookies([
		{
			name: "better-auth.session_token",
			value: "browser-verification",
			url: "http://localhost:3010",
		},
		{
			name: "better-auth-session_token",
			value: "browser-verification",
			url: "http://localhost:3010",
		},
	]);
	await page.context().setExtraHTTPHeaders({
		Cookie:
			"better-auth.session_token=browser-verification; better-auth-session_token=browser-verification",
		"x-personal-run-browser-test": "1",
	});
	await page.route("**/*", async (route) => {
		await route.continue({
			headers: {
				...route.request().headers(),
				cookie:
					"better-auth.session_token=browser-verification; better-auth-session_token=browser-verification",
				"x-personal-run-browser-test": "1",
			},
		});
	});
	await page.route("**/api/auth/get-session", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ user: { id: "user-1", name: "Runner" } }),
		});
	});
	await page.route("**/api/runs**", async (route) => {
		const request = route.request();
		const pathname = request
			.url()
			.replace(/^https?:\/\/[^/]+/, "")
			.split("?")[0];
		const method = request.method();
		let body = {};
		if (pathname === "/api/runs" && method === "POST") {
			state.created++;
			body = { runId: "run-browser" };
		} else if (pathname.endsWith("/points") && method === "POST") {
			state.points +=
				JSON.parse(request.postData() ?? "{}").points?.length ?? 0;
			body = { ok: true, accepted: 1, rejected: 0 };
		} else if (pathname.endsWith("/events") && method === "POST") {
			state.events.push(
				...(JSON.parse(request.postData() ?? "{}").events ?? []),
			);
			body = { ok: true, accepted: 1, rejected: 0 };
		} else if (pathname.endsWith("/pending-completion")) {
			state.pending++;
			body = { pending: true };
		} else if (pathname.endsWith("/complete")) {
			state.completed++;
			body = {
				result: {
					runId: "run-browser",
					durationSeconds: 12,
					distanceMeters: 22.24,
					paceSecondsPerKm: 540,
				},
			};
		} else if (pathname === "/api/runs/run-browser" && method === "GET") {
			body = {
				id: "run-browser",
				distanceMeters: 22.24,
				durationSeconds: 12,
				paceSecondsPerKm: 540,
				previewDistanceMeters: 21,
				calories: 2,
				startTime: "2026-08-23T10:00:00.000Z",
				endTime: "2026-08-23T10:00:12.000Z",
				splits: [],
				trackPoints: {
					segments: [
						[
							{ lat: 32.041, lng: 118.784, segmentIndex: 0 },
							{ lat: 32.0411, lng: 118.7841, segmentIndex: 0 },
						],
						[
							{ lat: 32.0412, lng: 118.7842, segmentIndex: 1 },
							{ lat: 32.0413, lng: 118.7843, segmentIndex: 1 },
						],
					],
				},
			};
		} else if (pathname === "/api/runs/run-browser" && method === "DELETE") {
			state.deleted++;
			body = { deleted: true };
		} else if (pathname === "/api/runs" && method === "GET") {
			body = { records: [{ id: "run-browser" }], total: 1 };
		} else {
			return route.fallback();
		}
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify(body),
		});
	});

	await page.setViewportSize({ width: 390, height: 844 });
	page.on("dialog", async (dialog) => dialog.accept());
	await page.goto("http://localhost:3010/run?personalRunBrowserTest=1");
	await page.waitForTimeout(2_000);
	if ((await page.getByRole("button", { name: "开始跑步" }).count()) === 0) {
		throw new Error(
			`Run page unavailable at ${page.url()}: ${(await page.locator("body").innerText()).slice(0, 500)}`,
		);
	}
	await page.getByRole("button", { name: "开始跑步" }).click();
	await page
		.context()
		.setGeolocation({ latitude: 32.0411, longitude: 118.7841 });
	await page.waitForTimeout(1_100);
	await page.getByRole("button", { name: "暂停跑步" }).click();
	await page.context().setGeolocation({ latitude: 32.05, longitude: 118.79 });
	await page.waitForTimeout(100);
	await page.getByRole("button", { name: "继续跑步" }).click();
	await page
		.context()
		.setGeolocation({ latitude: 32.0413, longitude: 118.7843 });
	await page.waitForTimeout(1_100);
	await page.getByRole("button", { name: "停止跑步" }).click();
	await page.waitForURL("**/summary?runId=run-browser");
	await page.getByText("跑步汇总").waitFor();
	await page.getByRole("button", { name: "删除本次跑步" }).click();
	await page.waitForFunction(() => window.location.pathname === "/run");
	const finalPath = page
		.url()
		.replace(/^https?:\/\/[^/]+/, "")
		.split("?")[0];

	if (
		state.created !== 1 ||
		state.pending !== 1 ||
		state.completed !== 1 ||
		state.deleted !== 1 ||
		!state.events.some((event) => event.type === "PAUSE") ||
		!state.events.some((event) => event.type === "RESUME") ||
		!state.events.some((event) => event.type === "STOP") ||
		state.documentFailures.length > 0 ||
		finalPath !== "/run"
	) {
		throw new Error(
			`Personal Run browser story failed: ${JSON.stringify(state)}`,
		);
	}
	return state;
};
