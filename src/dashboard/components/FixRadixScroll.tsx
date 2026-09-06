"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function FixRadixScroll() {
    const pathname = usePathname();

    useEffect(() => {
        const cleanup = () => {
            document.body.style.pointerEvents = "";
            document.documentElement.style.pointerEvents = "";
            document.body.removeAttribute("data-scroll-locked");
            document.documentElement.removeAttribute("data-scroll-locked");
            
            // Clean up any remaining Radix scroll lock styles if they were orphaned
            const radixStyles = document.querySelectorAll('style[data-radix-scroll-area-action]');
            radixStyles.forEach(style => style.remove());

            // Radix hides siblings using data-aria-hidden="true" and adds pointer-events: none to them.
            document.querySelectorAll('[data-aria-hidden="true"]').forEach((el) => {
                if (el instanceof HTMLElement) {
                    el.removeAttribute("data-aria-hidden");
                    el.removeAttribute("aria-hidden");
                    el.style.pointerEvents = "";
                }
            });
            
            // Just to be safe, also check aria-hidden
            document.querySelectorAll('[aria-hidden="true"]').forEach((el) => {
                if (el instanceof HTMLElement && el.style.pointerEvents === "none") {
                    el.style.pointerEvents = "";
                }
            });
        };

        // Run immediately on route change
        cleanup();
        
        // Run multiple times to ensure we catch any delayed unmounts
        for (let i = 1; i <= 5; i++) {
            setTimeout(cleanup, i * 100);
        }
    }, [pathname]);

    return null;
}
