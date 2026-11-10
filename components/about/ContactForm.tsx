"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import {
  enviarContacto,
  type ContactoState,
  type ContactoValores,
} from "@/app/acerca-de/actions";

const INICIAL: ContactoState = { ok: null };

/** Envuelve el formulario con una `key` para poder reiniciar por completo el estado de la acción. */
export default function ContactForm() {
  const [intento, setIntento] = useState(0);
  return <ContactFormInner key={intento} onReset={() => setIntento((n) => n + 1)} />;
}

function ContactFormInner({ onReset }: { onReset: () => void }) {
  const [state, formAction, pending] = useActionState(enviarContacto, INICIAL);
  const [shake, setShake] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uid = useId();

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function temblar() {
    setShake(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShake(false), 400);
  }

  // Comodidad en cliente: si falta algún campo no se invoca la acción. La validación real es la del servidor.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const datos = new FormData(e.currentTarget);
    const vacio = (["nombre", "correo", "mensaje"] as const).some(
      (c) => !String(datos.get(c) ?? "").trim(),
    );
    if (vacio) {
      e.preventDefault();
      temblar();
    }
  }

  if (state.ok === true) {
    return (
      <div className="contact-form">
        <div className="terminal-success">
          <div className="term-bar">
            <span className="dot r"></span>
            <span className="dot y"></span>
            <span className="dot g"></span>
            <span className="term-title">VAULT-OS // TERMINAL</span>
          </div>
          <div className="term-body" role="status">
            <div className="line">
              <span className="prompt">vault@arcade:~$</span> ./send_message --to=team
            </div>
            <div className="line dim">[OK] Conectando con servidor…</div>
            <div className="line dim">[OK] Validando contenido…</div>
            <div className="line dim">[OK] Transmitiendo paquete…</div>
            <div className="line success">
              &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {state.nombre.toUpperCase()}.
              <span className="caret" aria-hidden="true">_</span>
            </div>
            <div style={{ marginTop: 18 }}>
              <button className="btn btn-sm" type="button" onClick={onReset}>
                ENVIAR OTRO MENSAJE
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const valores: ContactoValores =
    state.ok === false ? state.valores : { nombre: "", correo: "", mensaje: "" };
  const invalidos = state.ok === false ? (state.campos ?? []) : [];

  return (
    <form
      className={"contact-form" + (shake ? " shake" : "")}
      action={formAction}
      onSubmit={onSubmit}
      noValidate
    >
      <div>
        <label className="label" htmlFor={`${uid}-nombre`}>NOMBRE</label>
        <input
          id={`${uid}-nombre`}
          name="nombre"
          className="field"
          placeholder="px_kai"
          autoComplete="name"
          defaultValue={valores.nombre}
          aria-invalid={invalidos.includes("nombre") || undefined}
        />
      </div>
      <div>
        <label className="label" htmlFor={`${uid}-correo`}>CORREO ELECTRÓNICO</label>
        <input
          id={`${uid}-correo`}
          name="correo"
          type="email"
          className="field"
          placeholder="jugador@vault.gg"
          autoComplete="email"
          defaultValue={valores.correo}
          aria-invalid={invalidos.includes("correo") || undefined}
        />
      </div>
      <div>
        <label className="label" htmlFor={`${uid}-mensaje`}>MENSAJE</label>
        <textarea
          id={`${uid}-mensaje`}
          name="mensaje"
          rows={5}
          className="field"
          placeholder="Cuéntanos qué tienes en mente…"
          defaultValue={valores.mensaje}
          aria-invalid={invalidos.includes("mensaje") || undefined}
        />
      </div>

      {state.ok === false && (
        <p className="contact-error" role="alert">{state.error}</p>
      )}

      <button className="btn btn-xl press" type="submit" disabled={pending} style={{ width: "100%" }}>
        {pending ? "ENVIANDO…" : "▶  ENVIAR MENSAJE"}
      </button>
    </form>
  );
}
