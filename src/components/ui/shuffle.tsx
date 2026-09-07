"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
} from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText as GSAPSplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, GSAPSplitText, useGSAP);

/**
 * Bleed (em per side) around each glyph inside its overflow-hidden strip.
 * The measured char box comes back narrower than the true advance once the
 * title's negative letter-spacing collapses into SplitText's isolated glyph
 * boxes, so a fixed px bleed can't cover the deficit at display sizes. An
 * em-proportional bleed self-scales to every screen and covers the tracking
 * deficit plus the outlined stroke's outer half and subpixel rounding.
 */
const STRIP_BLEED_EM = 0.1;

export type ShuffleDirection = "left" | "right" | "up" | "down";
export type ShuffleAnimationMode = "evenodd" | "random";
export type ShuffleTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span";

export interface ShuffleProps {
  /** The text content to shuffle. */
  text: string;
  /** Optional CSS class for the wrapper element. */
  className?: string;
  /** Inline styles applied to the wrapper element. */
  style?: CSSProperties;
  /** Direction the per-letter strip slides to reveal the final character. */
  shuffleDirection?: ShuffleDirection;
  /** Duration (s) of the strip slide per letter. */
  duration?: number;
  /** Max random delay per strip when animationMode is "random". */
  maxDelay?: number;
  /** GSAP ease for sliding and color tween. */
  ease?: gsap.TweenVars["ease"];
  /** Portion of the element that must enter view before starting. */
  threshold?: number;
  /** ScrollTrigger start offset (px, %, etc.). */
  rootMargin?: string;
  /** HTML tag to render for the text container. */
  tag?: ShuffleTag;
  /** Text alignment applied via inline style. */
  textAlign?: CSSProperties["textAlign"];
  /** Called after a full run completes (and on each loop repeat). */
  onShuffleComplete?: () => void;
  /** How many interim scrambled glyphs to scroll past before the final char. */
  shuffleTimes?: number;
  /** Odd/even staggered strips or random per-strip delays. */
  animationMode?: ShuffleAnimationMode;
  /** Repeat the shuffle indefinitely. */
  loop?: boolean;
  /** Delay (s) between loop repeats. */
  loopDelay?: number;
  /** Stagger (s) for strips in "evenodd" mode. */
  stagger?: number;
  /** Characters to use for interim scrambles; empty keeps original copies. */
  scrambleCharset?: string;
  /** Optional starting text color while shuffling. */
  colorFrom?: string;
  /** Optional final text color to tween to. */
  colorTo?: string;
  /** Auto-run only on first scroll into view. */
  triggerOnce?: boolean;
  /** Skip animation if user prefers reduced motion. */
  respectReducedMotion?: boolean;
  /** Allow re-playing the animation on hover after it completes. */
  triggerOnHover?: boolean;
}

/**
 * ReactBits "Shuffle" (TS port of the JS + CSS variant): animated text
 * reveal where per-letter strips slide past interim glyphs before settling
 * on the final characters. Type (family, size, case, leading) inherits from
 * context — only the strip mechanics live in CSS — so it adopts the hero's
 * General Sans lockup, including the outlined stroke, untouched.
 */
export function Shuffle({
  text,
  className = "",
  style = {},
  shuffleDirection = "right",
  duration = 0.35,
  maxDelay = 0,
  ease = "power3.out",
  threshold = 0.1,
  rootMargin = "-100px",
  tag = "p",
  textAlign = "center",
  onShuffleComplete,
  shuffleTimes = 1,
  animationMode = "evenodd",
  loop = false,
  loopDelay = 0,
  stagger = 0.03,
  scrambleCharset = "",
  colorFrom,
  colorTo,
  triggerOnce = true,
  respectReducedMotion = true,
  triggerOnHover = true,
}: ShuffleProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(
    () =>
      typeof document === "undefined" ||
      !("fonts" in document) ||
      document.fonts.status === "loaded",
  );
  const [ready, setReady] = useState(false);

  const splitRef = useRef<GSAPSplitText | null>(null);
  const wrappersRef = useRef<HTMLElement[]>([]);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const playingRef = useRef(false);
  const hoverHandlerRef = useRef<(() => void) | null>(null);
  const completedRef = useRef(false);
  // Bumped (debounced) whenever the viewport width changes so the GSAP effect
  // below re-measures its fixed-px strips instead of keeping stale geometry.
  const [resizeKey, setResizeKey] = useState(0);

  // Callback ref (stable): the lint rules forbid passing the ref object
  // itself through createElement, so the node is assigned on commit.
  const setRoot = useCallback((node: HTMLElement | null) => {
    ref.current = node;
  }, []);

  useEffect(() => {
    if (fontsLoaded) return;
    let cancelled = false;
    document.fonts.ready
      .then(() => {
        if (!cancelled) setFontsLoaded(true);
      })
      .catch(() => {
        /* fonts unavailable; render unshuffled */
      });
    return () => {
      cancelled = true;
    };
  }, [fontsLoaded]);

  // Strip widths are fixed-px snapshots of the glyphs at build time, so a
  // rotation or window resize would otherwise leave stale geometry behind.
  // Height-only changes (mobile URL bar) are ignored on purpose.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let lastWidth = window.innerWidth;
    let timer: number | undefined;
    const onResize = () => {
      if (window.innerWidth === lastWidth) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        lastWidth = window.innerWidth;
        setResizeKey((key) => key + 1);
      }, 250);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(timer);
    };
  }, []);

  const scrollTriggerStart = useMemo(() => {
    const startPct = (1 - threshold) * 100;
    const mm = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)?$/.exec(rootMargin || "");
    const mv = mm ? parseFloat(mm[1]) : 0;
    const mu = mm ? mm[2] || "px" : "px";
    const sign =
      mv === 0 ? "" : mv < 0 ? `-=${Math.abs(mv)}${mu}` : `+=${mv}${mu}`;
    return `top ${startPct}%${sign}`;
  }, [threshold, rootMargin]);

  useGSAP(
    () => {
      if (!ref.current || !text || !fontsLoaded) return;
      if (
        respectReducedMotion &&
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        setReady(true);
        onShuffleComplete?.();
        return;
      }

      const el = ref.current;

      const start = scrollTriggerStart;

      const removeHover = () => {
        if (hoverHandlerRef.current && ref.current) {
          ref.current.removeEventListener(
            "mouseenter",
            hoverHandlerRef.current,
          );
          hoverHandlerRef.current = null;
        }
      };

      const teardown = () => {
        if (tlRef.current) {
          tlRef.current.kill();
          tlRef.current = null;
        }
        if (wrappersRef.current.length) {
          wrappersRef.current.forEach((wrap) => {
            const inner = wrap.firstElementChild;
            const orig = inner?.querySelector('[data-orig="1"]');
            if (orig && wrap.parentNode)
              wrap.parentNode.replaceChild(orig, wrap);
          });
          wrappersRef.current = [];
        }
        try {
          splitRef.current?.revert();
        } catch {
          /* noop */
        }
        splitRef.current = null;
        playingRef.current = false;
      };

      const build = () => {
        teardown();

        splitRef.current = new GSAPSplitText(el, {
          type: "chars",
          charsClass: "shuffle-char",
          wordsClass: "shuffle-word",
          linesClass: "shuffle-line",
          smartWrap: true,
          reduceWhiteSpace: false,
        });

        const chars = splitRef.current.chars || [];
        wrappersRef.current = [];

        const rolls = Math.max(1, Math.floor(shuffleTimes));
        const em = parseFloat(window.getComputedStyle(el).fontSize) || 16;
        const rand = (set: string) =>
          set.charAt(Math.floor(Math.random() * set.length)) || "";
        const isVertical =
          shuffleDirection === "up" || shuffleDirection === "down";
        const metricsContext = isVertical
          ? document.createElement("canvas").getContext("2d")
          : null;

        const measureVerticalCell = (
          node: Element,
          lineBoxHeight: number,
        ): { cellHeight: number; padTop: number; padBottom: number } => {
          const computed = window.getComputedStyle(node);
          let fontHeight = 0;

          if (metricsContext) {
            metricsContext.font = [
              computed.fontStyle,
              computed.fontVariant,
              computed.fontWeight,
              computed.fontSize,
              computed.fontFamily,
            ].join(" ");

            const sample = `${node.textContent || "M"}${scrambleCharset}`;
            const metrics = metricsContext.measureText(sample);
            const ascent = metrics.fontBoundingBoxAscent;
            const descent = metrics.fontBoundingBoxDescent;
            if (Number.isFinite(ascent) && Number.isFinite(descent))
              fontHeight = ascent + descent;
          }

          if (!fontHeight) {
            const probe = node.cloneNode(true) as HTMLElement;
            probe.textContent = `${node.textContent || "M"}${scrambleCharset}`;
            Object.assign(probe.style, {
              position: "absolute",
              visibility: "hidden",
              pointerEvents: "none",
              width: "auto",
              height: "auto",
              whiteSpace: "nowrap",
              lineHeight: "normal",
              fontFamily: computed.fontFamily,
              fontSize: computed.fontSize,
              fontStyle: computed.fontStyle,
              fontVariant: computed.fontVariant,
              fontWeight: computed.fontWeight,
              fontStretch: computed.fontStretch,
            });
            document.body.appendChild(probe);
            fontHeight = probe.getBoundingClientRect().height;
            probe.remove();
          }

          const overflow = Math.max(0, Math.ceil(fontHeight - lineBoxHeight));
          const padTop = Math.floor(overflow / 2);
          return {
            cellHeight: lineBoxHeight + overflow,
            padTop,
            padBottom: overflow - padTop,
          };
        };

        chars.forEach((ch) => {
          const parent = ch.parentElement;
          if (!parent) return;

          const w = ch.getBoundingClientRect().width;
          const h = ch.getBoundingClientRect().height;
          if (!w) return;

          const { cellHeight, padTop, padBottom } = isVertical
            ? measureVerticalCell(ch, h)
            : { cellHeight: h, padTop: 0, padBottom: 0 };

          const wrap = document.createElement("span");
          // The strip is slightly wider than the measured glyph; the surplus
          // is cancelled with negative margins so the lockup keeps its exact
          // measured width while glyph edges stay unclipped.
          const bleed = isVertical ? 0 : em * STRIP_BLEED_EM;
          const cw = w + bleed * 2;
          Object.assign(wrap.style, {
            display: "inline-block",
            overflow: "hidden",
            width: cw + "px",
            marginLeft: `${-bleed}px`,
            marginRight: `${-bleed}px`,
            height: isVertical ? cellHeight + "px" : "auto",
            marginTop: isVertical ? -padTop + "px" : "0",
            marginBottom: isVertical ? -padBottom + "px" : "0",
            verticalAlign: "bottom",
          });

          const inner = document.createElement("span");
          Object.assign(inner.style, {
            display: "inline-block",
            whiteSpace: isVertical ? "normal" : "nowrap",
            willChange: "transform",
          });

          parent.insertBefore(wrap, ch);
          wrap.appendChild(inner);

          const chEl = ch as HTMLElement;
          const firstOrig = chEl.cloneNode(true) as HTMLElement;
          Object.assign(firstOrig.style, {
            display: isVertical ? "flex" : "inline-block",
            alignItems: isVertical ? "center" : "",
            justifyContent: isVertical ? "center" : "",
            height: isVertical ? cellHeight + "px" : "",
            lineHeight: isVertical ? h + "px" : "",
            width: cw + "px",
            textAlign: "center",
          });

          chEl.setAttribute("data-orig", "1");
          Object.assign(chEl.style, {
            display: isVertical ? "flex" : "inline-block",
            alignItems: isVertical ? "center" : "",
            justifyContent: isVertical ? "center" : "",
            height: isVertical ? cellHeight + "px" : "",
            lineHeight: isVertical ? h + "px" : "",
            width: cw + "px",
            textAlign: "center",
          });

          inner.appendChild(firstOrig);
          for (let k = 0; k < rolls; k++) {
            const c = chEl.cloneNode(true) as HTMLElement;
            if (scrambleCharset) c.textContent = rand(scrambleCharset);
            Object.assign(c.style, {
              display: isVertical ? "flex" : "inline-block",
              alignItems: isVertical ? "center" : "",
              justifyContent: isVertical ? "center" : "",
              height: isVertical ? cellHeight + "px" : "",
              lineHeight: isVertical ? h + "px" : "",
              width: cw + "px",
              textAlign: "center",
            });
            inner.appendChild(c);
          }
          inner.appendChild(chEl);

          const steps = rolls + 1;

          if (shuffleDirection === "right" || shuffleDirection === "down") {
            const firstCopy = inner.firstElementChild;
            const real = inner.lastElementChild;
            if (real) inner.insertBefore(real, inner.firstChild);
            if (firstCopy) inner.appendChild(firstCopy);
          }

          let startX = 0;
          let finalX = 0;
          let startY = 0;
          let finalY = 0;

          if (shuffleDirection === "right") {
            startX = -steps * cw;
            finalX = 0;
          } else if (shuffleDirection === "left") {
            startX = 0;
            finalX = -steps * cw;
          } else if (shuffleDirection === "down") {
            startY = -steps * cellHeight;
            finalY = 0;
          } else if (shuffleDirection === "up") {
            startY = 0;
            finalY = -steps * cellHeight;
          }

          if (shuffleDirection === "left" || shuffleDirection === "right") {
            gsap.set(inner, { x: startX, y: 0, force3D: true });
            inner.setAttribute("data-start-x", String(startX));
            inner.setAttribute("data-final-x", String(finalX));
          } else {
            gsap.set(inner, { x: 0, y: startY, force3D: true });
            inner.setAttribute("data-start-y", String(startY));
            inner.setAttribute("data-final-y", String(finalY));
          }

          if (colorFrom) inner.style.color = colorFrom;
          wrappersRef.current.push(wrap);
        });
      };

      const inners = () =>
        wrappersRef.current
          .map((w) => w.firstElementChild)
          .filter((el): el is HTMLElement => el instanceof HTMLElement);

      const randomizeScrambles = () => {
        if (!scrambleCharset) return;
        wrappersRef.current.forEach((w) => {
          const strip = w.firstElementChild;
          if (!strip) return;
          const kids = Array.from(strip.children);
          for (let i = 1; i < kids.length - 1; i++) {
            kids[i].textContent = scrambleCharset.charAt(
              Math.floor(Math.random() * scrambleCharset.length),
            );
          }
        });
      };

      const cleanupToStill = () => {
        wrappersRef.current.forEach((w) => {
          const strip = w.firstElementChild;
          if (!strip) return;
          const real = strip.querySelector('[data-orig="1"]');
          if (!real) return;
          strip.replaceChildren(real);
          (strip as HTMLElement).style.transform = "none";
          (strip as HTMLElement).style.willChange = "auto";
        });
      };

      const play = () => {
        const strips = inners();
        if (!strips.length) return;

        playingRef.current = true;
        const vertical =
          shuffleDirection === "up" || shuffleDirection === "down";

        const tl = gsap.timeline({
          smoothChildTiming: true,
          repeat: loop ? -1 : 0,
          repeatDelay: loop ? loopDelay : 0,
          onRepeat: () => {
            if (scrambleCharset) randomizeScrambles();
            if (vertical) {
              gsap.set(strips, {
                y: (_index, t) =>
                  parseFloat(
                    (t as HTMLElement).getAttribute("data-start-y") || "0",
                  ),
              });
            } else {
              gsap.set(strips, {
                x: (_index, t) =>
                  parseFloat(
                    (t as HTMLElement).getAttribute("data-start-x") || "0",
                  ),
              });
            }
            onShuffleComplete?.();
          },
          onComplete: () => {
            playingRef.current = false;
            if (!loop) {
              completedRef.current = true;
              cleanupToStill();
              if (colorTo) gsap.set(strips, { color: colorTo });
              onShuffleComplete?.();
              armHover();
            }
          },
        });

        const addTween = (targets: HTMLElement[], at: number) => {
          const vars: gsap.TweenVars = {
            duration,
            ease,
            force3D: true,
            stagger: animationMode === "evenodd" ? stagger : 0,
          };
          if (vertical) {
            vars.y = (_index, t) =>
              parseFloat(
                (t as HTMLElement).getAttribute("data-final-y") || "0",
              );
          } else {
            vars.x = (_index, t) =>
              parseFloat(
                (t as HTMLElement).getAttribute("data-final-x") || "0",
              );
          }

          tl.to(targets, vars, at);

          if (colorFrom && colorTo) {
            tl.to(targets, { color: colorTo, duration, ease }, at);
          }
        };

        if (animationMode === "evenodd") {
          const odd = strips.filter((_, i) => i % 2 === 1);
          const even = strips.filter((_, i) => i % 2 === 0);
          const oddTotal = duration + Math.max(0, odd.length - 1) * stagger;
          const evenStart = odd.length ? oddTotal * 0.7 : 0;
          if (odd.length) addTween(odd, 0);
          if (even.length) addTween(even, evenStart);
        } else {
          strips.forEach((strip) => {
            const d = Math.random() * maxDelay;
            const vars: gsap.TweenVars = {
              duration,
              ease,
              force3D: true,
            };
            if (vertical) {
              vars.y = parseFloat(strip.getAttribute("data-final-y") || "0");
            } else {
              vars.x = parseFloat(strip.getAttribute("data-final-x") || "0");
            }
            tl.to(strip, vars, d);
            if (colorFrom && colorTo)
              tl.fromTo(
                strip,
                { color: colorFrom },
                { color: colorTo, duration, ease },
                d,
              );
          });
        }

        tlRef.current = tl;
      };

      const armHover = () => {
        if (!triggerOnHover || !ref.current) return;
        removeHover();
        const handler = () => {
          if (playingRef.current) return;
          build();
          if (scrambleCharset) randomizeScrambles();
          play();
        };
        hoverHandlerRef.current = handler;
        ref.current.addEventListener("mouseenter", handler);
      };

      const create = () => {
        // After a completed non-looping run the strips are already cleaned
        // back to plain fluid text. A resize-triggered rebuild must not
        // replay the animation — it only re-arms hover, which re-measures
        // fresh strips at hover time.
        if (completedRef.current && !loop) {
          teardown();
          armHover();
          setReady(true);
          return;
        }
        build();
        if (scrambleCharset) randomizeScrambles();
        play();
        armHover();
        setReady(true);
      };

      const st = ScrollTrigger.create({
        trigger: el,
        start,
        once: triggerOnce,
        onEnter: create,
      });

      return () => {
        st.kill();
        removeHover();
        teardown();
        setReady(false);
      };
    },
    {
      dependencies: [
        text,
        duration,
        maxDelay,
        ease,
        scrollTriggerStart,
        fontsLoaded,
        shuffleDirection,
        shuffleTimes,
        animationMode,
        loop,
        loopDelay,
        stagger,
        scrambleCharset,
        colorFrom,
        colorTo,
        triggerOnce,
        respectReducedMotion,
        triggerOnHover,
        onShuffleComplete,
        resizeKey,
      ],
      scope: ref,
    },
  );

  const commonStyle = useMemo(
    () => ({ textAlign, ...style }),
    [textAlign, style],
  );

  const classes = useMemo(
    () => `shuffle-parent ${ready ? "is-ready" : ""} ${className}`,
    [ready, className],
  );

  const Tag = (tag || "p") as ElementType;
  return (
    <Tag
      ref={setRoot}
      className={classes}
      style={commonStyle}
    >
      {text}
    </Tag>
  );
}
