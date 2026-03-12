import { useEffect, useRef } from "react";

export function ReclameAquiSeal() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // Avoid duplicating
    if (containerRef.current.querySelector("script")) return;

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.id = "ra-embed-verified-seal";
    script.src = "https://s3.amazonaws.com/raichu-beta/ra-verified/bundle.js";
    script.dataset.id = "SEpqak1Mcm9aM09nMm0wbDpid2lsZC1yZWZvcm1hcw==";
    script.dataset.target = "ra-verified-seal";
    script.dataset.model = "horizontal_1";

    containerRef.current.appendChild(script);
  }, []);

  return <div id="ra-verified-seal" ref={containerRef} />;
}
