"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Loader2, Maximize2, RotateCcw, View } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DrawLocation } from "./warehouse-3d-scene";
import type { ScenePlan } from "@/lib/warehouse/geometry";

export type WarehouseViewportHandle = {
  focus: (locator: string) => void;
  reset: () => void;
  top: () => void;
};

type Props = {
  plan: ScenePlan;
  locations: DrawLocation[];
  selected: string | null;
  onSelect: (locator: string | null) => void;
};

export const WarehouseViewport = forwardRef<WarehouseViewportHandle, Props>(
  function WarehouseViewport({ plan, locations, selected, onSelect }, ref) {
    const hostRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<{
      setPlan: (plan: ScenePlan) => void;
      setLocations: (locations: DrawLocation[]) => void;
      setSelected: (locator: string | null) => void;
      setAutoRotate: (enabled: boolean) => void;
      focus: (locator: string) => void;
      resetView: (animated?: boolean) => void;
      topView: () => void;
      dispose: () => void;
    } | null>(null);
    const onSelectRef = useRef(onSelect);
    const planRef = useRef(plan);
    const locationsRef = useRef(locations);
    const selectedRef = useRef(selected);
    const [status, setStatus] = useState<"loading" | "ready" | "error">(
      "loading",
    );
    const [rotate, setRotate] = useState(true);

    useEffect(() => {
      onSelectRef.current = onSelect;
    }, [onSelect]);
    useEffect(() => {
      planRef.current = plan;
    }, [plan]);
    useEffect(() => {
      locationsRef.current = locations;
    }, [locations]);
    useEffect(() => {
      selectedRef.current = selected;
    }, [selected]);

    useEffect(() => {
      let cancelled = false;
      const host = hostRef.current;
      if (!host) return;

      import("./warehouse-3d-scene")
        .then(({ WarehouseScene }) => {
          if (cancelled || !hostRef.current) return;
          const scene = new WarehouseScene(hostRef.current, {
            onSelect: (locator) => onSelectRef.current(locator),
          });
          sceneRef.current = scene;
          scene.setPlan(planRef.current);
          scene.setLocations(locationsRef.current);
          scene.setSelected(selectedRef.current);
          scene.setAutoRotate(true);
          setStatus("ready");
        })
        .catch((error) => {
          console.error("Failed to initialise the 3D warehouse", error);
          setStatus("error");
        });

      return () => {
        cancelled = true;
        sceneRef.current?.dispose();
        sceneRef.current = null;
      };
    }, []);

    useEffect(() => {
      sceneRef.current?.setPlan(plan);
    }, [plan]);

    useEffect(() => {
      sceneRef.current?.setLocations(locations);
    }, [locations]);

    useEffect(() => {
      sceneRef.current?.setSelected(selected);
    }, [selected]);

    useEffect(() => {
      sceneRef.current?.setAutoRotate(rotate);
    }, [rotate]);

    useImperativeHandle(
      ref,
      () => ({
        focus: (locator: string) => sceneRef.current?.focus(locator),
        reset: () => sceneRef.current?.resetView(true),
        top: () => sceneRef.current?.topView(),
      }),
      [],
    );

    return (
      <div className="relative h-[420px] w-full overflow-hidden rounded-lg border bg-[#0a1523] sm:h-[520px] xl:h-[620px]">
        <div ref={hostRef} className="absolute inset-0" />

        {status === "loading" && (
          <div className="absolute inset-0 grid place-items-center bg-[#0a1523] text-sm text-slate-300">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading 3D warehouse…
            </div>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 grid place-items-center bg-[#0a1523] px-6 text-center text-sm text-slate-300">
            The 3D view could not start. This browser may not support WebGL —
            try Chrome or Edge.
          </div>
        )}

        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-md border border-white/10 bg-[#0d1a2b]/85 p-1 backdrop-blur">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-200 hover:bg-white/10 hover:text-white"
            title={rotate ? "Stop auto-rotate" : "Start auto-rotate"}
            onClick={() => {
              setRotate((value) => {
                const next = !value;
                sceneRef.current?.setAutoRotate(next);
                return next;
              });
            }}
          >
            <RotateCcw
              className={`h-4 w-4 ${rotate ? "animate-spin [animation-duration:3s]" : ""}`}
            />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-200 hover:bg-white/10 hover:text-white"
            title="Top view"
            onClick={() => sceneRef.current?.topView()}
          >
            <View className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-200 hover:bg-white/10 hover:text-white"
            title="Reset camera"
            onClick={() => sceneRef.current?.resetView(true)}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-white/10 bg-[#0d1a2b]/80 px-3 py-2 text-[11px] text-slate-300 backdrop-blur">
          Drag to orbit · Scroll to zoom · Right-drag to pan · Click a location
          for details
        </div>
      </div>
    );
  },
);
