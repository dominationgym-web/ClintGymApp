import React, { forwardRef, useCallback, useEffect, useRef } from "react";
import {
  Platform,
  ScrollView as RNScrollView,
  type GestureResponderEvent,
  type ScrollViewProps,
} from "react-native";
import { foldScrollTarget, type FoldTap } from "@/lib/foldScroll";

// The app's ScrollView: React Native's own, plus one thing. When a tap opens a
// drop-down, the page scrolls so the tapped heading sits at the top of the
// screen and the reading goes downward (GRIZZ 2026-10-30: he kept having to
// scroll UP to find where a drop-down started). It watches the tapped heading
// itself, so every tap-to-open heading in the app gets it without changes.
// Import ScrollView from here, not from react-native.

// Checks after a tap: the open usually shows on the next frame, slower ones
// (loading data) a little later.
const CHECK_AFTER_MS = [120, 450];
const WATCH_MS = 900;

type Pending = {
  measureAfter: (done: (t: Omit<FoldTap, "contentYBefore" | "heightBefore"> | null) => void) => void;
  contentYBefore: number;
  heightBefore: number;
  endedAt: number | null;
  dragged: boolean;
  done: boolean;
};

type HostLike = {
  measureLayout?: (rel: unknown, ok: (x: number, y: number, w: number, h: number) => void, fail?: () => void) => void;
  measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
};

const ScrollView = forwardRef<RNScrollView, ScrollViewProps>(function ScrollView(props, ref) {
  const inner = useRef<RNScrollView | null>(null);
  const height = useRef(0);
  const pending = useRef<Pending | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const vertical = !props.horizontal;

  const setRef = useCallback(
    (node: RNScrollView | null) => {
      inner.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  const check = useCallback(() => {
    const p = pending.current;
    if (!p || p.done || p.dragged || p.endedAt === null) return;
    if (Date.now() - p.endedAt > WATCH_MS) return;
    p.measureAfter((after) => {
      if (!after || p.done || p.dragged || pending.current !== p) return;
      const y = foldScrollTarget({ ...after, contentYBefore: p.contentYBefore, heightBefore: p.heightBefore });
      if (y === null) return;
      p.done = true;
      inner.current?.scrollTo({ y, animated: true });
    });
  }, []);

  const tapEnded = useCallback(() => {
    const p = pending.current;
    if (!p || p.dragged) return;
    p.endedAt = Date.now();
    timers.current.forEach(clearTimeout);
    timers.current = CHECK_AFTER_MS.map((ms) => setTimeout(check, ms));
  }, [check]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Phone (iOS / Android): the tapped view comes with the touch.
  const onTouchStart = (e: GestureResponderEvent) => {
    props.onTouchStart?.(e);
    const ne = e.nativeEvent as unknown as { __foldSeen?: boolean };
    // A ScrollView inside another one: only the closest one follows the tap.
    if (Platform.OS === "web" || !vertical || ne.__foldSeen) return;
    ne.__foldSeen = true;
    const target = e.target as unknown as HostLike;
    const content = (inner.current as unknown as { getInnerViewRef?: () => unknown } | null)?.getInnerViewRef?.();
    const frame = inner.current?.getNativeScrollRef?.() as unknown as HostLike | null;
    pending.current = null;
    if (!content || !frame?.measureInWindow || !target?.measureLayout || !target.measureInWindow) return;
    const p: Pending = {
      contentYBefore: NaN,
      heightBefore: height.current,
      endedAt: null,
      dragged: false,
      done: false,
      measureAfter: (done) => {
        target.measureLayout!(
          content,
          (_x, contentYAfter) => {
            target.measureInWindow!((_x2, screenY) => {
              frame.measureInWindow!((_x3, viewTop, _w, viewHeight) => {
                done({ contentYAfter, heightAfter: height.current, screenY, viewTop, viewHeight });
              });
            });
          },
          () => done(null),
        );
      },
    };
    pending.current = p;
    target.measureLayout(content, (_x, y) => (p.contentYBefore = y), () => {});
  };

  const onTouchEnd = (e: GestureResponderEvent) => {
    props.onTouchEnd?.(e);
    if (Platform.OS !== "web") tapEnded();
  };

  // Laptop (website): the same, with the browser's own page elements.
  useEffect(() => {
    if (Platform.OS !== "web" || !vertical) return;
    const node = (inner.current as unknown as { getScrollableNode?: () => HTMLElement | null })?.getScrollableNode?.();
    if (!node || typeof node.addEventListener !== "function") return;
    const contentY = (el: Element) => el.getBoundingClientRect().top - node.getBoundingClientRect().top + node.scrollTop;
    const down = (ev: Event) => {
      const seen = ev as Event & { __foldSeen?: boolean };
      if (seen.__foldSeen) return;
      seen.__foldSeen = true;
      const target = ev.target as Element | null;
      pending.current = null;
      if (!target || typeof target.getBoundingClientRect !== "function") return;
      pending.current = {
        contentYBefore: contentY(target),
        heightBefore: node.scrollHeight,
        endedAt: null,
        dragged: false,
        done: false,
        measureAfter: (done) => {
          if (!target.isConnected) return done(null);
          done({
            contentYAfter: contentY(target),
            heightAfter: node.scrollHeight,
            screenY: target.getBoundingClientRect().top,
            viewTop: node.getBoundingClientRect().top,
            viewHeight: node.clientHeight,
          });
        },
      };
    };
    const moved = () => {
      if (pending.current) pending.current.dragged = true;
    };
    node.addEventListener("pointerdown", down);
    node.addEventListener("click", tapEnded);
    node.addEventListener("wheel", moved, { passive: true });
    node.addEventListener("touchmove", moved, { passive: true });
    return () => {
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("click", tapEnded);
      node.removeEventListener("wheel", moved);
      node.removeEventListener("touchmove", moved);
    };
  }, [vertical, tapEnded]);

  return (
    <RNScrollView
      {...props}
      ref={setRef}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onScrollBeginDrag={(e) => {
        if (pending.current) pending.current.dragged = true;
        props.onScrollBeginDrag?.(e);
      }}
      onContentSizeChange={(w, h) => {
        height.current = h;
        props.onContentSizeChange?.(w, h);
        check();
      }}
    />
  );
});

// So `useRef<ScrollView>` keeps working where screens hold a ref to it.
type ScrollView = RNScrollView;
export { ScrollView };
