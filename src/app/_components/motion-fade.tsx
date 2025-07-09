'use client'

import { motion } from "framer-motion"
import { type ReactNode } from "react"

interface MotionFadeProps {
    children: ReactNode
}

export function MotionFade({ children }: MotionFadeProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.05 }}
        >
            {children}
        </motion.div>
    )
} 