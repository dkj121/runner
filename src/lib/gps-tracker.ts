const DEFAULT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 1000,
};

export function startWatching(
  onPosition: (pos: GeolocationPosition) => void,
  onError?: (err: GeolocationPositionError) => void,
): number {
  return navigator.geolocation.watchPosition(
    onPosition,
    onError ?? (() => {}),
    DEFAULT_OPTIONS,
  );
}

export function stopWatching(watchId: number): void {
  navigator.geolocation.clearWatch(watchId);
}
