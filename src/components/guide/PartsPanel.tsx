"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Plan } from "@/lib/types";
import { HwArt, canActualSize } from "../art/Hardware";
import { IAlert, IArrowLeft, IArrowRight, ICheck, IClose, IRuler } from "../art/Icons";
import Thumb from "../Thumb";
import { haptic } from "./hooks";
import { playTick } from "./sound";
import { getPref, setPref } from "@/lib/store";

/**
 * Parts are an exception check too: tap only what is missing.
 * "Everything's here" ticks the whole list in a quick cascade.
 */
export default function PartsPanel({
  plan,
  missing,
  onToggle,
  onNext,
  onBack,
  onHover,
  onMissingHelp,
}: {
  plan: Plan;
  missing: Set<string>;
  onToggle: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
  onHover: (ids: string[] | null) => void;
  onMissingHelp: () => void;
}) {
  const panels = plan.parts.filter((p) => !p.extra);
  const hw = plan.hardware.filter((h) => !h.notIncluded);
  const extra = plan.hardware.filter((h) => h.notIncluded);
  const ids = [...panels.map((p) => p.id), ...hw.map((h) => h.id)];
  const [actual, setActual] = useState(false);
  const [ppm, setPpm] = useState(() => getPref("ppm", 96 / 25.4));
  const [calib, setCalib] = useState(false);
  const [ok, setOk] = useState<Set<string>>(new Set());
  const [going, setGoing] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const nMissing = ids.filter((i) => missing.has(i)).length;

  const confirm = () => {
    if (going) return;
    setGoing(true);
    const list = ids.filter((i) => !missing.has(i));
    const gap = Math.min(70, 900 / Math.max(1, list.length));
    list.forEach((id, i) =>
      timers.current.push(
        setTimeout(() => {
          setOk((s) => new Set(s).add(id));
          if (i % 2 === 0) playTick();
          haptic(4);
        }, 60 + i * gap),
      ),
    );
    timers.current.push(setTimeout(onNext, 60 + list.length * gap + 420));
  };

  const row = (id: string, i: number, content: React.ReactNode, qty: number) => {
    const miss = missing.has(id);
    const good = ok.has(id);
    return (
      <motion.button
        key={id}
        className={"prow" + (miss ? " miss" : "") + (good ? " ok" : "")}
        onClick={() => {
          if (going) return;
          haptic();
          onToggle(id);
        }}
        onMouseEnter={() => onHover([id])}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover([id])}
        onBlur={() => onHover(null)}
        aria-pressed={miss}
        aria-label={`${miss ? "Marked missing" : "Mark missing"}`}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: Math.min(0.5, 0.03 * i), duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        {content}
        <span className="pqty">{qty}&times;</span>
        <span className="pstate">
          <AnimatePresence mode="popLayout" initial={false}>
            {miss ? (
              <motion.span key="m" className="pmiss" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}>
                Missing
              </motion.span>
            ) : good ? (
              <motion.span key="o" className="pok" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 20 }}>
                <ICheck size={15} strokeWidth={3} />
              </motion.span>
            ) : (
              <motion.span key="n" className="pdot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            )}
          </AnimatePresence>
        </span>
      </motion.button>
    );
  };

  return (
    <div className="pane">
      <div className="pane-scroll">
        <header className="pane-head">
          <p className="eyebrow">Unpack</p>
          <h2>Check the box</h2>
          <p className="sub">Lay everything out like the drawing. Tap anything that&apos;s missing.</p>
        </header>

        <h3 className="section-title">
          Panels <span className="count-pill">{panels.reduce((s, p) => s + p.qty, 0)}</span>
        </h3>
        <div className="plist">
          {panels.map((p, i) =>
            row(
              p.id,
              i,
              <>
                <Thumb id={plan.spec.name + plan.spec.variant} plan={plan} mode={{ kind: "part", ref: p.id }} w={120} h={84} className="pthumb" />
                <span className="letter sm">{p.label}</span>
                <span className="ptext">
                  <b>{p.name}</b>
                  <span>{dims(p.size)}</span>
                </span>
              </>,
              p.qty,
            ),
          )}
        </div>

        <h3 className="section-title">
          Hardware <span className="count-pill">{hw.reduce((s, h) => s + h.qty, 0)}</span>
          <button className={"toggle" + (actual ? " on" : "")} onClick={() => setActual(!actual)} aria-pressed={actual}>
            <IRuler size={15} /> Actual size
          </button>
        </h3>
        {actual && (
          <p className="note">
            Lay a piece on the screen to compare.{" "}
            <button className="btn link inline" onClick={() => setCalib(true)}>
              Calibrate
            </button>
          </p>
        )}
        <div className={"plist" + (actual ? " actual" : "")}>
          {hw.map((h, i) =>
            row(
              h.id,
              panels.length + i,
              <>
                <span className="part-art">{actual && canActualSize(h.kind) ? <HwArt kind={h.kind} len={h.len} dia={h.dia} pxPerMm={ppm} /> : <HwArt kind={h.kind} len={h.len} dia={h.dia} fit={56} />}</span>
                <span className="ptext">
                  <b>{h.name}</b>
                  <span>{h.spec || " "}</span>
                </span>
              </>,
              h.qty,
            ),
          )}
        </div>

        {extra.length > 0 && (
          <div className="notbox">
            <IAlert size={18} />
            <div>
              <b>Not in the box</b>
              <span>Wall screws and plugs for fixing it to the wall. Pick ones that suit your wall.</span>
            </div>
          </div>
        )}

        <AnimatePresence>
          {nMissing > 0 && (
            <motion.div className="missbox" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
              <b>
                {nMissing} {nMissing === 1 ? "thing" : "things"} missing
              </b>
              <span>You can still build the steps that don&apos;t need {nMissing === 1 ? "it" : "them"}. Spare fittings are usually free at IKEA.</span>
              <button className="btn link inline" onClick={onMissingHelp}>
                How to get spare parts
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="pane-foot">
        <button className="btn round" onClick={onBack} aria-label="Back">
          <IArrowLeft />
        </button>
        <button className={"btn primary big" + (going ? " going" : "")} onClick={confirm}>
          <span>{going ? "All set" : nMissing ? "Continue anyway" : "Everything's here"}</span>
          <IArrowRight />
        </button>
      </div>

      <AnimatePresence>
        {calib && (
          <Calibrate
            ppm={ppm}
            onClose={(v) => {
              if (v) {
                setPpm(v);
                setPref("ppm", v);
              }
              setCalib(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function dims(s: [number, number, number]) {
  const v = [...s].sort((a, b) => b - a).map((x) => Math.round(x / 10));
  return v[2] < 1 ? `${v[0]} × ${v[1]} cm` : `${v[0]} × ${v[1]} × ${Math.max(1, v[2])} cm`;
}

function Calibrate({ ppm, onClose }: { ppm: number; onClose: (v?: number) => void }) {
  const [v, setV] = useState(ppm);
  const w = 85.6 * v, h = 53.98 * v;
  return (
    <motion.div className="modal-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => onClose()}>
      <motion.div className="modal" initial={{ y: 30, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, opacity: 0 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Calibrate actual size">
        <button className="btn round small close" onClick={() => onClose()} aria-label="Close">
          <IClose />
        </button>
        <h3>Match a bank card</h3>
        <p className="sub">Hold any card against the screen and slide until the outline matches its edges.</p>
        <div className="calib-stage">
          <div className="calib-card" style={{ width: w, height: h }}>
            <span />
          </div>
        </div>
        <input type="range" min={2.4} max={7.5} step={0.01} value={v} onChange={(e) => setV(Number(e.target.value))} aria-label="Card size" />
        <button className="btn primary" onClick={() => onClose(v)}>
          Looks right
        </button>
      </motion.div>
    </motion.div>
  );
}
