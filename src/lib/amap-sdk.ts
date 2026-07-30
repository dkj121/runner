import "@amap/amap-jsapi-types";
import AMapLoader from "@amap/amap-jsapi-loader";

export interface AMapSDK {
	Map: typeof AMap.Map;
	Marker: typeof AMap.Marker;
	Polyline: typeof AMap.Polyline;
	GeometryUtil: {
		distance: (p1: [number, number], p2: [number, number]) => number;
	};
}

let sdkPromise: Promise<AMapSDK> | null = null;

export function loadAMapSDK(): Promise<AMapSDK> {
	if (!process.env.NEXT_PUBLIC_AMAP_KEY) {
		throw new Error("NEXT_PUBLIC_AMAP_KEY 未配置");
	}
	if (!sdkPromise) {
		sdkPromise = AMapLoader.load({
			key: process.env.NEXT_PUBLIC_AMAP_KEY!,
			version: "2.0",
			securityJsCode: process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE!,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any) as Promise<AMapSDK>;
	}
	return sdkPromise;
}
