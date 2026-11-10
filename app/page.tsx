import Link from "next/link";
import { GAMES } from "@/lib/games";
import FeatureIcon from "@/components/home/FeatureIcon";
import FloatingSilhouettes from "@/components/home/FloatingSilhouettes";
import MiniCard from "@/components/home/MiniCard";
import RevealOnScroll from "@/components/home/RevealOnScroll";
import { FAQ, FEATURES, PRICE_PERKS, RECENT, STATS, TOP } from "@/components/home/content";

const fmt = (n: number) => n.toLocaleString("es-ES");

export default function Home() {
  return (
    <div className="home">
      <RevealOnScroll />

      {/* HERO */}
      <section className="home-hero">
        <FloatingSilhouettes />
        <div className="home-hero-inner">
          <div className="hero-eyebrow pixel neon-yellow">
            ▸ INSERTA UNA MONEDA<span className="blink">_</span>
          </div>
          <h1 className="home-title">
            <span className="line-1">EL ARCADE</span>
            <span className="line-2">CLÁSICO ESTÁ</span>
            <span className="line-3">DE VUELTA</span>
          </h1>
          <p className="home-sub">
            Juega los mejores clásicos directamente en tu navegador.
            <br />
            Sin descargas. Sin costo. Solo diversión.
          </p>
          <div className="home-ctas">
            <Link href="/biblioteca" className="btn btn-xl btn-pulse">
              ▶ EXPLORAR JUEGOS
            </Link>
            <Link href="/acceso" className="btn btn-xl btn-magenta">
              ✦ CREAR CUENTA
            </Link>
          </div>
          <div className="hero-scroll" aria-hidden="true">
            <span>DESLIZA</span>
            <span className="arrow">▼</span>
          </div>
        </div>
      </section>

      {/* POR QUÉ */}
      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-magenta">{"// 01"}</div>
          <h2 className="section-title">¿POR QUÉ ARCADE VAULT?</h2>
          <div className="section-rule" />
        </div>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div key={f.t} className={`feature-card ${f.c}`}>
              <FeatureIcon kind={f.i} />
              <div className="ft-title pixel">{f.t}</div>
              <div className="ft-desc">{f.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* JUEGOS */}
      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-cyan">{"// 02"}</div>
          <h2 className="section-title">JUEGOS DISPONIBLES AHORA</h2>
          <div className="section-rule" />
        </div>
        <div className="mini-rail">
          {GAMES.slice(0, 6).map((g) => (
            <MiniCard key={g.id} game={g} />
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <Link href="/biblioteca" className="btn btn-lg">
            VER TODOS LOS JUEGOS →
          </Link>
        </div>
      </section>

      {/* ESTADÍSTICAS */}
      <section className="home-stats reveal">
        <div className="stats-inner">
          {STATS.map((st) => (
            <div key={st.u} className="stat-block">
              <div className="stat-n neon-yellow">{st.n}</div>
              <div className="stat-u pixel">{st.u}</div>
              <div className="stat-s">{st.s}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ACTIVIDAD */}
      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-yellow">{"// 03"}</div>
          <h2 className="section-title">ACTIVIDAD EN VIVO</h2>
          <div className="section-rule" />
        </div>
        <div className="activity-grid">
          <div className="activity-card">
            <div className="ac-head">
              <div className="ac-title pixel">▸ ÚLTIMAS PUNTUACIONES</div>
            </div>
            <div className="ticker">
              {RECENT.map((r, i) => (
                <div key={r.p} className="tick-row" style={{ animationDelay: `${i * 60}ms` }}>
                  <span className={`tk-p neon-${r.c}`}>{r.p}</span>
                  <span className="tk-mid">▸ {r.g}</span>
                  <span className="tk-s">+{fmt(r.s)}</span>
                  <span className="tk-t">{r.t}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="activity-card">
            <div className="ac-head">
              <div className="ac-title pixel neon-magenta">▸ TOP JUGADORES · HOY</div>
              <Link href="/salon-de-la-fama" className="lb-link">
                VER SALÓN →
              </Link>
            </div>
            <div className="top-list">
              {TOP.map((r, i) => (
                <div key={r.p} className={`top-row${i < 3 ? ` top${i + 1}` : ""}`}>
                  <span className="tp-rk">#{String(r.r).padStart(2, "0")}</span>
                  <span className="tp-bar">
                    <span className="tp-fill" style={{ width: `${100 - i * 16}%` }} />
                  </span>
                  <span className="tp-p">{r.p}</span>
                  <span className="tp-s">{fmt(r.s)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PRECIOS */}
      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-green">{"// 04"}</div>
          <h2 className="section-title">PRECIOS</h2>
          <div className="section-rule" />
        </div>
        <div className="pricing-grid">
          <div className="price-card">
            <div className="pc-label pixel">PLAN ÚNICO</div>
            <div className="pc-name pixel">JUGADOR VAULT</div>
            <div className="pc-amount">
              <span className="pc-amount-n">$0</span>
              <span className="pc-amount-u">/ SIEMPRE</span>
            </div>
            <div className="pc-tag">SIN TRUCOS · SIN LETRA PEQUEÑA</div>
            <ul className="pc-list">
              {PRICE_PERKS.map((p) => (
                <li key={p}>✔ {p}</li>
              ))}
            </ul>
            <Link href="/acceso" className="btn btn-xl btn-pulse w-full">
              EMPEZAR GRATIS →
            </Link>
            <div className="pc-foot">No pedimos tarjeta. Nunca lo haremos.</div>
            <div className="pc-stamp pixel">
              FREE
              <br />
              PLAY
            </div>
          </div>

          <div className="pricing-faq">
            {FAQ.map((f) => (
              <div key={f.q} className="faq-item">
                <div className="faq-q pixel">{f.q}</div>
                <div className="faq-a">{f.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="home-final reveal">
        <h2 className="final-title pixel">¿LISTO PARA JUGAR?</h2>
        <Link href="/biblioteca" className="btn btn-xl btn-pulse final-cta">
          INSERTAR MONEDA →
        </Link>
        <div className="final-tag">Gratis. Sin registro obligatorio. Empieza en segundos.</div>
      </section>
    </div>
  );
}
