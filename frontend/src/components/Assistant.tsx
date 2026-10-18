import { useRef } from "react";
export function Assistant({
  stage = "",
  reduced = false,
}: {
  stage?: string;
  reduced?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const greet = () => {
    if (!reduced && !matchMedia("(prefers-reduced-motion: reduce)").matches)
      ref.current?.animate(
        [
          { transform: "rotate(0deg)" },
          { transform: "rotate(-7deg)" },
          { transform: "rotate(5deg)" },
          { transform: "rotate(0deg)" },
        ],
        { duration: 650, easing: "ease-in-out" },
      );
  };
  return (
    <div
      className={`assistant-figure ${stage ? "working" : ""}`}
      onPointerEnter={greet}
      aria-hidden="true"
    >
      <svg className="orbits" viewBox="0 0 290 180">
        <path d="M35 93H95m100 0h60M62 40l48 29m70 48 42 27M65 145l45-28m70-48 44-29" />
        <circle cx="35" cy="93" r="6" />
        <circle cx="255" cy="93" r="6" />
        <circle cx="62" cy="40" r="4" />
        <circle cx="222" cy="144" r="4" />
        <circle cx="65" cy="145" r="4" />
        <circle cx="224" cy="40" r="4" />
      </svg>
      <div className="assistant-core" ref={ref}>
        <div className="assistant-eyes">
          <i />
          <i />
        </div>
        <div className="assistant-smile" />
      </div>
      <span className="orbit-label label-left">context</span>
      <span className="orbit-label label-right">clarity</span>
    </div>
  );
}
