"use client";

import Link from "next/link";

const pathways = [
  { label: "Nonprofits", href: "/npo" },
  { label: "Companies", href: "/company" },
  { label: "Sponsors", href: "/sponsor" },
  { label: "Students", href: "/student" },
];

const resources = [
  { label: "Contact", href: "/contact" },
  { label: "About", href: "/about" },
  { label: "Projects", href: "/projects" },
];

export default function Footer() {
  return (
    <footer
      className="border-t px-6 py-16"
      style={{
        borderColor: "var(--glass-border-soft)",
        background: "var(--color-bg-main)",
      }}
    >
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link
              href="/"
              className="font-heading text-sm font-semibold tracking-wide hover:opacity-80 transition-opacity"
            >
              TETHOS
            </Link>
            <p
              className="mt-3 text-xs leading-relaxed max-w-[200px]"
              style={{ color: "var(--color-text-muted)" }}
            >
              Technology that moves people forward. Student-built, real-world
              impact.
            </p>
          </div>

          {/* Pathways */}
          <div>
            <p
              className="text-xs font-medium uppercase tracking-widest mb-4"
              style={{ color: "var(--color-text-subtle)" }}
            >
              Pathways
            </p>
            <ul className="space-y-2">
              {pathways.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-xs transition-colors hover:text-white"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <p
              className="text-xs font-medium uppercase tracking-widest mb-4"
              style={{ color: "var(--color-text-subtle)" }}
            >
              Resources
            </p>
            <ul className="space-y-2">
              {resources.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-xs transition-colors hover:text-white"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Social */}
          <div>
            <p
              className="text-xs font-medium uppercase tracking-widest mb-4"
              style={{ color: "var(--color-text-subtle)" }}
            >
              Connect
            </p>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://github.com/tethos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs transition-colors hover:text-white"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://linkedin.com/company/tethos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs transition-colors hover:text-white"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  LinkedIn
                </a>
              </li>
              <li>
                <a
                  href="https://instagram.com/tethos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs transition-colors hover:text-white"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Instagram
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between pt-8 border-t gap-4"
          style={{ borderColor: "var(--glass-border-soft)" }}
        >
          <p
            className="text-xs"
            style={{ color: "var(--color-text-subtle)" }}
          >
            &copy; {new Date().getFullYear()} Tethos. All rights reserved.
          </p>
          <p
            className="text-xs"
            style={{ color: "var(--color-text-subtle)" }}
          >
            Built by students, designed with taste.
          </p>
        </div>
      </div>
    </footer>
  );
}
