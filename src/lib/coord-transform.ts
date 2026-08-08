/**
 * WGS-84 → GCJ-02 坐标转换。
 *
 * `navigator.geolocation` 返回的是国际标准 WGS-84 坐标，而高德地图 (AMap)
 * 在中国大陆范围内使用国测局加密坐标系 GCJ-02（俗称“火星坐标系”）渲染。
 * 若不转换直接把 WGS-84 坐标喂给 AMap，绘制出的轨迹会偏移 50~500 米——
 * 穿过建筑物、跨过河流、偏离实际道路。此文件仅用于地图展示层的坐标转换，
 * 数据库存储与距离计算应始终使用原始 WGS-84 坐标。
 */

const PI = Math.PI;
// 克拉索夫斯基椭球参数，GCJ-02 转换算法固定使用
const EARTH_SEMI_MAJOR_AXIS = 6378245.0;
const ECCENTRICITY_SQUARED = 0.00669342162296594323;

export interface LatLng {
	lat: number;
	lng: number;
}

/**
 * 中国大陆（含近海）边界之外的坐标，WGS-84 与 GCJ-02 视为等价，不做偏移。
 * 覆盖香港、澳门、台湾及海外地区。
 */
function outOfChina(lat: number, lng: number): boolean {
	return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x: number, y: number): number {
	let ret =
		-100.0 +
		2.0 * x +
		3.0 * y +
		0.2 * y * y +
		0.1 * x * y +
		0.2 * Math.sqrt(Math.abs(x));
	ret +=
		((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) /
		3.0;
	ret +=
		((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0;
	ret +=
		((160.0 * Math.sin((y / 12.0) * PI) + 320.0 * Math.sin((y * PI) / 30.0)) *
			2.0) /
		3.0;
	return ret;
}

function transformLng(x: number, y: number): number {
	let ret =
		300.0 +
		x +
		2.0 * y +
		0.1 * x * x +
		0.1 * x * y +
		0.1 * Math.sqrt(Math.abs(x));
	ret +=
		((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) /
		3.0;
	ret +=
		((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0;
	ret +=
		((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) *
			2.0) /
		3.0;
	return ret;
}

/**
 * 将 WGS-84 坐标（GPS 原始坐标）转换为 GCJ-02 坐标（高德地图坐标系）。
 * 中国大陆之外的坐标原样返回。
 */
export function wgs84ToGcj02(lat: number, lng: number): LatLng {
	if (outOfChina(lat, lng)) {
		return { lat, lng };
	}

	let dLat = transformLat(lng - 105.0, lat - 35.0);
	let dLng = transformLng(lng - 105.0, lat - 35.0);
	const radLat = (lat / 180.0) * PI;
	let magic = Math.sin(radLat);
	magic = 1 - ECCENTRICITY_SQUARED * magic * magic;
	const sqrtMagic = Math.sqrt(magic);
	dLat =
		(dLat * 180.0) /
		(((EARTH_SEMI_MAJOR_AXIS * (1 - ECCENTRICITY_SQUARED)) /
			(magic * sqrtMagic)) *
			PI);
	dLng =
		(dLng * 180.0) /
		((EARTH_SEMI_MAJOR_AXIS / sqrtMagic) * Math.cos(radLat) * PI);

	return { lat: lat + dLat, lng: lng + dLng };
}

/**
 * 便捷方法：转换携带 {lat, lng} 的对象，保留其余字段（如 timestamp）不变。
 */
export function wgs84ToGcj02Point<T extends LatLng>(point: T): T {
	const { lat, lng } = wgs84ToGcj02(point.lat, point.lng);
	return { ...point, lat, lng };
}
