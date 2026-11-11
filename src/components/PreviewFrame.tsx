"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Sandboxed preview iframe with a visible focus ring. Chrome does not match :focus on the
 * iframe element while focus is inside its sandboxed document, so the parent tracks it:
 * while the window is blurred, it checks whether this iframe is the active element.
 * Moving focus from one preview to another does not re-fire window blur, hence the poll.
 */
export function PreviewFrame({ title, src }: { title: string; src: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    let poll: ReturnType<typeof setInterval> | undefined;
    const check = () => setFocused(document.activeElement === frame.current);
    const onBlur = () => {
      // activeElement updates after the blur event is dispatched.
      setTimeout(check, 0);
      clearInterval(poll);
      poll = setInterval(check, 150);
    };
    const onFocus = () => {
      clearInterval(poll);
      setFocused(false);
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(poll);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
  return (
    <iframe
      ref={frame}
      title={title}
      src={src}
      sandbox=""
      data-focused={focused}
      className="h-[32rem] w-full rounded-lg border border-stone-600 bg-white data-[focused=true]:outline-2 data-[focused=true]:outline-offset-4 data-[focused=true]:outline-amber-200"
    />
  );
}
