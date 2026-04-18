"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import TsiLogo from "@/components/ui/TsiLogo";

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Nonprofits", href: "/npo" },
  { label: "Companies", href: "/company" },
  { label: "Sponsors", href: "/sponsor" },
  { label: "Students", href: "/student" },
  { label: "Genesis", href: "/genesis" },
];

const CONTACT = { label: "Contact", href: "mailto:team@tethos.ca" };

/* Spring configs */
const SPRING_SNAPPY = { type: "spring" as const, stiffness: 500, damping: 30, mass: 0.8 };
const SPRING_SOFT = { type: "spring" as const, stiffness: 300, damping: 25 };

export default function DropdownNav() {
  const [open, setOpen] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [visible, setVisible] = useState(true);
  const pathname = usePathname();
  const lastScrollY = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hide on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY > lastScrollY.current && currentY > 100) {
        setVisible(false);
        setOpen(false);
      } else {
        setVisible(true);
      }
      lastScrollY.current = currentY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 250);
  };

  const currentLabel = NAV_ITEMS.find((item) => item.href === pathname)?.label || "Menu";

  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50 flex items-start justify-between px-6 md:px-8 pt-4"
      animate={{ y: visible ? 0 : -80 }}
      transition={SPRING_SOFT}
    >
      {/* Logo with press feedback */}
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92, y: 2 }}
        transition={SPRING_SNAPPY}
      >
        <Link href="/" className="text-white block mt-1">
          <TsiLogo width={28} height={28} />
        </Link>
      </motion.div>

      {/* Dropdown trigger area */}
      <div
        className="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Trigger button with Framer-style press animation */}
        <motion.button
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer"
          onClick={() => setOpen(!open)}
          onMouseDown={() => setPressed(true)}
          onMouseUp={() => setPressed(false)}
          onMouseLeave={() => setPressed(false)}
          aria-expanded={open}
          aria-label="Navigation menu"
          animate={{
            scale: pressed ? 0.95 : 1,
            y: pressed ? 2.5 : 0,
            background: open ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
            borderColor: open ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)",
          }}
          whileHover={{
            background: "rgba(255,255,255,0.06)",
            borderColor: "rgba(255,255,255,0.1)",
          }}
          transition={{ duration: 0.1 }}
          style={{
            border: "1px solid rgba(255,255,255,0.05)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          {/* Hamburger with morphing animation */}
          <div className="flex flex-col justify-center items-center w-4 h-4 gap-[4px]">
            <motion.span
              className="block bg-white/60 rounded-full"
              animate={{
                width: open ? 14 : 16,
                height: 1.5,
                rotate: open ? 45 : 0,
                y: open ? 2.75 : 0,
              }}
              transition={SPRING_SNAPPY}
            />
            <motion.span
              className="block bg-white/60 rounded-full"
              animate={{
                width: 12,
                height: 1.5,
                opacity: open ? 0 : 1,
                scaleX: open ? 0 : 1,
              }}
              transition={SPRING_SNAPPY}
            />
            <motion.span
              className="block bg-white/60 rounded-full"
              animate={{
                width: open ? 14 : 10,
                height: 1.5,
                rotate: open ? -45 : 0,
                y: open ? -2.75 : 0,
              }}
              transition={SPRING_SNAPPY}
            />
          </div>

          {/* Current page label */}
          <motion.span
            className="text-xs font-medium hidden sm:inline"
            animate={{ opacity: open ? 0.7 : 0.5 }}
            style={{ color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-highlight)" }}
          >
            {currentLabel}
          </motion.span>
        </motion.button>

        {/* Dropdown panel */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.95, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -6, scale: 0.95, filter: "blur(4px)" }}
              transition={{ ...SPRING_SNAPPY, stiffness: 400, damping: 28 }}
              className="absolute right-0 top-full mt-2 rounded-xl overflow-hidden"
              style={{
                background: "rgba(15,15,16,0.94)",
                backdropFilter: "blur(32px)",
                WebkitBackdropFilter: "blur(32px)",
                border: "1px solid rgba(255,255,255,0.08)",
                minWidth: "190px",
                boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset",
              }}
            >
              <nav className="py-2">
                {NAV_ITEMS.map((item, i) => {
                  const isActive = pathname === item.href;
                  return (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: i * 0.04,
                        duration: 0.25,
                        ease: [0.25, 0.1, 0.25, 1],
                      }}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="group relative flex items-center gap-3 px-5 py-2.5"
                      >
                        {/* Active indicator dot */}
                        <motion.div
                          className="w-1 h-1 rounded-full flex-shrink-0"
                          animate={{
                            scale: isActive ? 1 : 0,
                            background: isActive ? "#1d9bf0" : "transparent",
                          }}
                          transition={SPRING_SNAPPY}
                        />

                        {/* Label */}
                        <motion.span
                          className="text-[13px] font-medium"
                          style={{ fontFamily: "var(--font-highlight)" }}
                          animate={{
                            color: isActive ? "#1d9bf0" : "rgba(255,255,255,0.5)",
                            x: 0,
                          }}
                          whileHover={{
                            color: isActive ? "#1d9bf0" : "rgba(255,255,255,0.8)",
                            x: 3,
                          }}
                          transition={{ duration: 0.15 }}
                        >
                          {item.label}
                        </motion.span>

                        {/* Hover background */}
                        <motion.div
                          className="absolute inset-0 rounded-lg -z-10 mx-2"
                          initial={{ opacity: 0 }}
                          whileHover={{ opacity: 1, background: "rgba(255,255,255,0.04)" }}
                          transition={{ duration: 0.15 }}
                        />
                      </Link>
                    </motion.div>
                  );
                })}

                {/* Divider */}
                <motion.div
                  className="mx-4 my-1.5"
                  initial={{ scaleX: 0, opacity: 0 }}
                  animate={{ scaleX: 1, opacity: 1 }}
                  transition={{ delay: NAV_ITEMS.length * 0.04 + 0.05, duration: 0.3 }}
                  style={{
                    height: "1px",
                    background: "rgba(255,255,255,0.06)",
                    transformOrigin: "left",
                  }}
                />

                {/* Contact */}
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: NAV_ITEMS.length * 0.04 + 0.1,
                    duration: 0.25,
                    ease: [0.25, 0.1, 0.25, 1],
                  }}
                >
                  <motion.a
                    href={CONTACT.href}
                    className="group relative flex items-center gap-3 px-5 py-2.5"
                  >
                    <div className="w-1 h-1 flex-shrink-0" />
                    <motion.span
                      className="text-[13px] font-medium"
                      style={{
                        fontFamily: "var(--font-highlight)",
                        color: "rgba(255,255,255,0.35)",
                      }}
                      whileHover={{ color: "rgba(255,255,255,0.7)", x: 3 }}
                      transition={{ duration: 0.15 }}
                    >
                      {CONTACT.label}
                    </motion.span>
                  </motion.a>
                </motion.div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}
