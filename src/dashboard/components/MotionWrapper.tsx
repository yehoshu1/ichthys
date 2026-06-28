"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface Props {
    children: ReactNode;
    className?: string;
}

// Container for staggering children
export function FadeInStagger({ children, className }: Props) {
    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={{
                hidden: { opacity: 0 },
                visible: {
                    opacity: 1,
                    transition: {
                        staggerChildren: 0.05
                    }
                }
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

// Individual item that cascades in
export function FadeInItem({ children, className }: Props) {
    return (
        <motion.div
            variants={{
                hidden: { opacity: 0, y: 15 },
                visible: {
                    opacity: 1,
                    y: 0,
                    transition: {
                        type: "spring",
                        stiffness: 300,
                        damping: 24
                    }
                }
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

// For interactive cards/elements
export function InteractiveCard({ children, className }: Props) {
    return (
        <motion.div
            whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
            className={className}
        >
            {children}
        </motion.div>
    );
}
