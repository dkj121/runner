"use client";

import Link from "next/link";
import RunMap from "@/lib/map-loader";
import useRunTracker from "@/lib/use-run-tracker";

function StatCard({
  value,
  unit,
  accent,
}: {
  value: string;
  unit: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <div className={`text-3xl font-bold tracking-tight ${accent}`}>
        {value}
      </div>
      <div className="mt-0.5 text-xs text-gray-400">{unit}</div>
    </div>
  );
}

export default function RunPage() {
  const { status, distance, duration, pace, track, start, pause, resume, stop } =
    useRunTracker("1");

  const showResult = status === "idle" && track.length > 0;

  return (
    <div className="flex h-dvh flex-col bg-gray-50">
      <RunMap track={track} finished={showResult} />

      <div className="grid grid-cols-2 gap-3 px-4 pt-4">
        <StatCard value={distance} unit="距离 (km)" accent="text-green-600" />
        <StatCard value={duration} unit="时长" accent="text-gray-900" />
        <StatCard value={pace} unit="配速" accent="text-blue-600" />
        <StatCard value="0" unit="卡路里" accent="text-rose-500" />
      </div>

      <div className="flex items-center justify-center gap-4 px-4 pb-8 pt-6">
        {status === "idle" ? (
          <button
            onClick={start}
            className="w-40 rounded-full bg-green-500 px-8 py-4 text-lg font-semibold text-white shadow-sm shadow-green-500/30 transition-all active:scale-95 active:bg-green-600"
          >
            开始跑步
          </button>
        ) : (
          <>
            <button
              onClick={status === "running" ? pause : resume}
              className="flex size-16 items-center justify-center rounded-full bg-white text-xl shadow-sm ring-1 ring-gray-200 transition-all active:scale-90"
            >
              {status === "running" ? (
                <svg className="size-6" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg className="size-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <button
              onClick={stop}
              className="flex size-16 items-center justify-center rounded-full bg-red-500 text-white shadow-sm shadow-red-500/30 transition-all active:scale-90"
            >
              <svg className="size-6" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          </>
        )}
      </div>

      {showResult && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-12 pt-20 sm:items-center sm:pb-0">
          <div className="w-full max-w-sm rounded-3xl bg-white px-8 pb-8 pt-10 text-center shadow-2xl transition-all duration-300">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-green-100">
              <svg
                className="size-7 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-bold text-gray-900">跑步结束</h2>

            <div className="mt-8 space-y-6">
              <div>
                <div className="text-4xl font-bold text-green-600">
                  {distance}
                </div>
                <div className="mt-1 text-sm text-gray-400">距离 (km)</div>
              </div>
              <div className="h-px bg-gray-100" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-semibold text-gray-900">
                    {duration}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-400">时长</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-blue-600">
                    {pace}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-400">配速</div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <button
                onClick={start}
                className="w-full rounded-full bg-green-500 py-3.5 text-base font-semibold text-white shadow-sm transition-all active:scale-[0.98] active:bg-green-600"
              >
                再来一次
              </button>
              <Link
                href="/"
                className="w-full rounded-full border border-gray-200 py-3.5 text-base font-semibold text-gray-600 transition-all active:scale-[0.98] active:bg-gray-50"
              >
                返回首页
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
