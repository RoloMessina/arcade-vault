"use client";

import { useEffect } from "react";

/**
 * Activa la animación de aparición de las secciones `.reveal`.
 * Añade `reveal-on` a <html> (solo entonces el CSS las oculta) y marca cada sección con `.in`
 * al entrar en pantalla. Sin JS o sin IntersectionObserver el contenido queda visible.
 */
export default function RevealOnScroll() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const root = document.documentElement;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12 },
    );
    root.classList.add("reveal-on");
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      root.classList.remove("reveal-on");
    };
  }, []);

  return null;
}
