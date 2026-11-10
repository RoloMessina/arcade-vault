"use server";

import { Resend } from "resend";

export type ContactoValores = { nombre: string; correo: string; mensaje: string };

export type ContactoState =
  | { ok: null } // estado inicial
  | { ok: true; nombre: string } // enviado, Resend confirmó
  | { ok: false; error: string; valores: ContactoValores; campos?: (keyof ContactoValores)[] };

const MAX_NOMBRE = 80;
const MAX_CORREO = 254;
const MAX_MENSAJE = 2000;
const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ERROR_ENVIO = "NO SE PUDO ENVIAR EL MENSAJE. INTÉNTALO DE NUEVO MÁS TARDE.";

function leer(formData: FormData, clave: keyof ContactoValores): string {
  const v = formData.get(clave);
  return typeof v === "string" ? v.trim() : "";
}

export async function enviarContacto(
  _prev: ContactoState,
  formData: FormData,
): Promise<ContactoState> {
  const valores: ContactoValores = {
    nombre: leer(formData, "nombre"),
    correo: leer(formData, "correo"),
    mensaje: leer(formData, "mensaje"),
  };

  // Validación (la definitiva; la del cliente es solo comodidad).
  const campos: (keyof ContactoValores)[] = [];
  let error = "";

  if (!valores.nombre || valores.nombre.length > MAX_NOMBRE) {
    campos.push("nombre");
    error ||= !valores.nombre
      ? "ESCRIBE TU NOMBRE."
      : `EL NOMBRE NO PUEDE SUPERAR ${MAX_NOMBRE} CARACTERES.`;
  }
  if (!valores.correo || valores.correo.length > MAX_CORREO || !CORREO_RE.test(valores.correo)) {
    campos.push("correo");
    error ||= "ESCRIBE UN CORREO ELECTRÓNICO VÁLIDO.";
  }
  if (!valores.mensaje || valores.mensaje.length > MAX_MENSAJE) {
    campos.push("mensaje");
    error ||= !valores.mensaje
      ? "ESCRIBE UN MENSAJE."
      : `EL MENSAJE NO PUEDE SUPERAR ${MAX_MENSAJE} CARACTERES.`;
  }

  if (campos.length > 0) return { ok: false, error, valores, campos };

  const apiKey = process.env.RESEND_API_KEY;
  const destino = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !destino) {
    console.error("[contacto] Falta RESEND_API_KEY o CONTACT_TO_EMAIL en el entorno.");
    return { ok: false, error: ERROR_ENVIO, valores };
  }

  try {
    const resend = new Resend(apiKey);
    const { error: resendError } = await resend.emails.send({
      from: "Arcade Vault <onboarding@resend.dev>",
      to: destino,
      replyTo: valores.correo,
      subject: `Contacto Arcade Vault — ${valores.nombre}`,
      text: `Nombre: ${valores.nombre}\nCorreo: ${valores.correo}\n\nMensaje:\n${valores.mensaje}`,
    });

    if (resendError) {
      console.error("[contacto] Resend devolvió un error:", resendError);
      return { ok: false, error: ERROR_ENVIO, valores };
    }
  } catch (e) {
    console.error("[contacto] Excepción al enviar con Resend:", e);
    return { ok: false, error: ERROR_ENVIO, valores };
  }

  return { ok: true, nombre: valores.nombre };
}
