"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type Ref } from "react";
import { answerFor, GREETINGS, QUICK_CHIPS, type GharArea } from "./ghar-faq";

type Msg = { from: "bot" | "me"; text: string };
type Mood = "" | "sleep" | "shock";

/** The house-shaped robot. `lookRef` gets the eye group so the pointer can steer it. */
function GharSvg({ lookRef, className }: { lookRef?: Ref<SVGGElement>; className?: string }) {
  return (
    <svg className={`ghar ${className ?? ""}`} viewBox="0 0 120 124" aria-hidden="true">
      <ellipse className="shd" cx="60" cy="118" rx="28" ry="4.5" style={{ fill: "var(--hard)" }} />
      <g className="fl">
        <g style={{ fill: "var(--line-2)" }}>
          <circle className="smk" cx="33" cy="12" r="4" />
          <circle className="smk" cx="33" cy="12" r="4" />
          <circle className="smk" cx="33" cy="12" r="4" />
        </g>
        <rect x="27" y="16" width="12" height="20" rx="2.5" style={{ fill: "var(--bot-body)", stroke: "var(--bot-line)", strokeWidth: 4 }} />
        <g className="pin">
          <path d="M86 34V22" style={{ stroke: "var(--bot-line)", strokeWidth: 4, strokeLinecap: "round" }} />
          <circle className="ping" cx="86" cy="12" r="7" style={{ fill: "none", stroke: "var(--m)", strokeWidth: 3 }} />
          <path
            className="pin-h"
            d="M86 23c-5-6-8-9-8-13a8 8 0 0 1 16 0c0 4-3 7-8 13z"
            style={{ fill: "var(--m)", stroke: "var(--bot-line)", strokeWidth: 3.4, strokeLinejoin: "round" }}
          />
          <circle cx="86" cy="10" r="2.6" style={{ fill: "var(--bot-line)" }} />
        </g>
        <path d="M10 52 60 16l50 36z" style={{ fill: "var(--m)", stroke: "var(--bot-line)", strokeWidth: 5, strokeLinejoin: "round" }} />
        <path d="M32 40 56 23" style={{ stroke: "white", strokeWidth: 3.5, strokeLinecap: "round", opacity: 0.5 }} />
        <rect x="20" y="42" width="80" height="66" rx="21" style={{ fill: "var(--bot-body)", stroke: "var(--bot-line)", strokeWidth: 5 }} />
        <rect x="30" y="53" width="60" height="40" rx="12" style={{ fill: "var(--bot-face)", stroke: "var(--bot-line)", strokeWidth: 3 }} />
        <path d="M36 60q4-3 10-3" style={{ fill: "none", stroke: "white", strokeWidth: 3, strokeLinecap: "round", opacity: 0.9 }} />
        <g className="look" ref={lookRef}>
          <g className="eo">
            <rect className="eye" x="42" y="63" width="9" height="13" rx="4.5" style={{ fill: "var(--bot-eye)" }} />
            <rect className="eye" x="69" y="63" width="9" height="13" rx="4.5" style={{ fill: "var(--bot-eye)" }} />
          </g>
          <g className="eh" style={{ fill: "none", stroke: "var(--bot-eye)", strokeWidth: 3.4, strokeLinecap: "round" }}>
            <path d="M41 71q5.5-7 11 0M68 71q5.5-7 11 0" />
          </g>
        </g>
        <g className="ec" style={{ fill: "none", stroke: "var(--bot-eye)", strokeWidth: 3.4, strokeLinecap: "round" }}>
          <path d="M41 70q5.5 4 11 0M68 70q5.5 4 11 0" />
        </g>
        <path className="m-smile" d="M54 83q6 4.5 12 0" style={{ fill: "none", stroke: "var(--bot-eye)", strokeWidth: 2.8, strokeLinecap: "round" }} />
        <ellipse className="m-o" cx="60" cy="84" rx="3.4" ry="3.8" style={{ fill: "var(--bot-eye)" }} />
        <circle cx="37" cy="83" r="3.4" style={{ fill: "var(--m-mid)", opacity: 0.45 }} />
        <circle cx="83" cy="83" r="3.4" style={{ fill: "var(--m-mid)", opacity: 0.45 }} />
        <rect className="cup" x="11" y="62" width="13" height="24" rx="6.5" style={{ fill: "var(--bot-line)" }} />
        <rect className="cup" x="96" y="62" width="13" height="24" rx="6.5" style={{ fill: "var(--bot-line)" }} />
        <path d="M17 85C18 99 30 103 42 101" style={{ fill: "none", stroke: "var(--bot-line)", strokeWidth: 3.4, strokeLinecap: "round" }} />
        <circle className="mic" cx="45" cy="101" r="4.4" style={{ stroke: "var(--bot-line)", strokeWidth: 2.6 }} />
        <g className="zz" style={{ font: "800 14px var(--font-sans)", fill: "var(--ink)" }}>
          <text x="100" y="40">z</text>
          <text x="107" y="30">z</text>
        </g>
      </g>
    </svg>
  );
}

type Props = { area: GharArea };

export function Ghar({ area }: Props) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "bot", text: GREETINGS[area].hello }]);
  const [typing, setTyping] = useState(false);
  const [mood, setMood] = useState<Mood>("");
  const [shy, setShy] = useState(false);
  const [bubble, setBubble] = useState("");
  const [dotSeen, setDotSeen] = useState(false);

  const looks = useRef<(SVGGElement | null)[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openRef = useRef(open);
  const moodRef = useRef(mood);
  const shyRef = useRef(shy);
  const shySaid = useRef(false);
  useEffect(() => {
    openRef.current = open;
    moodRef.current = mood;
    shyRef.current = shy;
  });

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const talk = useCallback((text: string, ms = 4500) => {
    if (openRef.current) return;
    if (sayTimer.current) clearTimeout(sayTimer.current);
    setBubble(text);
    sayTimer.current = setTimeout(() => setBubble(""), ms);
  }, []);

  // Pointer tracking: eyes follow, idle sleep, wake-up joke.
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let raf = 0;
    let px = 0;
    let py = 0;
    let lastMove = Date.now();
    const aim = () => {
      raf = 0;
      for (const el of looks.current) {
        if (!el || !el.isConnected || !el.ownerSVGElement) continue;
        const r = el.ownerSVGElement.getBoundingClientRect();
        if (!r.width) continue;
        const dx = px - (r.left + r.width / 2);
        const dy = py - (r.top + r.height * 0.6);
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, d / 260);
        el.style.transform = `translate(${((dx / d) * k * 5.5).toFixed(2)}px,${((dy / d) * k * 4).toFixed(2)}px)`;
      }
    };
    const onMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      lastMove = Date.now();
      if (moodRef.current === "sleep") {
        setMood("shock");
        talk("I wasn't sleeping! Promise.", 3000);
        later(() => setMood((m) => (m === "shock" ? "" : m)), 1100);
      }
      if (!reduce && !raf) raf = requestAnimationFrame(aim);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    const nap = setInterval(() => {
      if (!document.hidden && !openRef.current && !moodRef.current && !shyRef.current && Date.now() - lastMove > 25000) {
        setMood("sleep");
      }
    }, 3000);
    return () => {
      window.removeEventListener("pointermove", onMove);
      clearInterval(nap);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [later, talk]);

  // Opening line, then clean up every timer on unmount.
  useEffect(() => {
    const t = timers.current;
    const first = GREETINGS[area].bubble;
    if (first) later(() => talk(first.text, first.ms), first.delay);
    return () => {
      t.forEach(clearTimeout);
      if (sayTimer.current) clearTimeout(sayTimer.current);
    };
  }, [area, later, talk]);

  // Auth pages: he closes his eyes while a hidden password field has focus.
  useEffect(() => {
    if (area !== "auth") return;
    const isHiddenPw = (el: EventTarget | null) => el instanceof HTMLInputElement && el.type === "password";
    const onIn = (e: FocusEvent) => {
      if (!isHiddenPw(e.target)) return;
      setShy(true);
      if (!shySaid.current) {
        shySaid.current = true;
        talk("Typing a password? I'm not looking.", 3200);
      }
    };
    const onOut = () => setShy(false);
    // the show/hide toggle swaps the type while focused; re-check on every click too
    const onClick = () => setShy(isHiddenPw(document.activeElement));
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
      document.removeEventListener("click", onClick);
    };
  }, [area, talk]);

  // Page cues: other islands can ask him to say something; on the landing he notices the lamp.
  useEffect(() => {
    const onSay = (e: Event) => talk(String((e as CustomEvent<string>).detail), 5000);
    const onTheme = (e: Event) => {
      const dark = (e as CustomEvent<string>).detail === "dark";
      later(() => talk(dark ? "Who turned off the lights?" : "Ahh, daylight. Much better.", 3600), 900);
    };
    window.addEventListener("ghar-say", onSay);
    if (area === "marketing") window.addEventListener("leads-theme", onTheme);
    return () => {
      window.removeEventListener("ghar-say", onSay);
      window.removeEventListener("leads-theme", onTheme);
    };
  }, [area, later, talk]);

  useEffect(() => {
    const b = bodyRef.current;
    if (b) b.scrollTop = b.scrollHeight;
  }, [msgs.length, typing]);

  const toggle = () => {
    const next = !open;
    if (sayTimer.current) clearTimeout(sayTimer.current);
    setBubble("");
    setOpen(next);
    setDotSeen(true);
    setMood("");
    if (next) later(() => inputRef.current?.focus(), 80);
  };

  const ask = (text: string) => {
    const q = text.trim();
    if (!q || typing) return;
    setMsgs((m) => [...m, { from: "me", text: q }]);
    setTyping(true);
    const a = answerFor(area, q);
    later(() => {
      setMsgs((m) => [...m, { from: "bot", text: a }]);
      setTyping(false);
    }, 700 + Math.min(a.length * 10, 1100));
  };

  const send = (e: FormEvent) => {
    e.preventDefault();
    const v = inputRef.current?.value ?? "";
    if (inputRef.current) inputRef.current.value = "";
    ask(v);
  };

  const gharCls = typing ? "g-talk" : shy ? "g-shy" : mood ? `g-${mood}` : "";
  const unread = !dotSeen && !open ? "unread" : "";

  return (
    <div className="bot">
      {open && (
        <div className="chat" role="dialog" aria-label="Chat with Ghar">
          <div className="chat-h">
            <span className="mini">
              <GharSvg className="g-happy" lookRef={(el) => { looks.current[1] = el; }} />
            </span>
            <div style={{ lineHeight: 1.25 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Ghar</div>
              <div style={{ fontSize: 12.5, opacity: 0.75 }}>LEADS helper · replies in seconds</div>
            </div>
            <button type="button" className="x" aria-label="Close chat" onClick={toggle}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <div className="chat-b" ref={bodyRef} aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={`msg ${m.from === "bot" ? "bot-m" : "me-m"}`}>
                {m.text}
              </div>
            ))}
            {typing && (
              <div className="typing" aria-label="Ghar is typing">
                <i />
                <i />
                <i />
              </div>
            )}
          </div>
          <div className="chips">
            {QUICK_CHIPS[area].map((label) => (
              <button key={label} type="button" className="qc" onClick={() => ask(label)}>
                {label}
              </button>
            ))}
          </div>
          <form className="chat-f" onSubmit={send}>
            <input ref={inputRef} type="text" placeholder={GREETINGS[area].placeholder} aria-label="Message Ghar" autoComplete="off" />
            <button type="submit" aria-label="Send">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </form>
        </div>
      )}
      {bubble && !open && (
        <div className="bot-say" role="status">
          {bubble}
        </div>
      )}
      <button
        type="button"
        className="bot-btn"
        aria-label={open ? "Close chat with Ghar" : "Chat with Ghar, the LEADS helper"}
        aria-expanded={open}
        onClick={toggle}
      >
        <span className={`g-wrap ${gharCls} ${unread}`} style={{ display: "block", width: "100%", height: "100%" }}>
          <GharSvg lookRef={(el) => { looks.current[0] = el; }} />
        </span>
      </button>
    </div>
  );
}
