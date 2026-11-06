"use strict";

/* Pantalla del modo práctica: ejercicios al azar, corrección, puntaje y racha. */

const CLAVE_PUNTAJE = "laboratorio-subredes-puntaje";

// Lo guardado puede estar vacío o roto: en ese caso se empieza de cero
function leerPuntaje() {
  try {
    const guardado = JSON.parse(leerGuardado(CLAVE_PUNTAJE));
    const inicial = puntajeInicial();
    const valido = Object.keys(inicial).every((clave) => Number.isInteger(guardado?.[clave]) && guardado[clave] >= 0);
    return valido ? guardado : inicial;
  } catch {
    return puntajeInicial();
  }
}

function iniciarPractica() {
  const tipo = document.getElementById("prac-tipo");
  const enunciado = document.getElementById("prac-enunciado");
  const formulario = document.getElementById("prac-formulario");
  const entradaTexto = document.getElementById("prac-entrada-texto");
  const entradaOpciones = document.getElementById("prac-entrada-opciones");
  const campo = document.getElementById("prac-respuesta");
  const corregir = document.getElementById("prac-corregir");
  const botonesOpcion = [...entradaOpciones.querySelectorAll("button")];
  const mensaje = document.getElementById("prac-mensaje");
  const devolucion = document.getElementById("prac-devolucion");
  const resultado = document.getElementById("prac-resultado");
  const diagnostico = document.getElementById("prac-diagnostico");
  const explicacion = document.getElementById("prac-explicacion");
  const otro = document.getElementById("prac-otro");
  const salidaPuntaje = document.getElementById("prac-puntaje");
  const salidaRacha = document.getElementById("prac-racha");
  const salidaMejor = document.getElementById("prac-mejor");

  let ejercicio = null;
  let respondido = false;
  let puntaje = leerPuntaje();

  function dibujarPuntaje() {
    salidaPuntaje.textContent = `${puntaje.aciertos}/${puntaje.intentos}`;
    salidaRacha.textContent = puntaje.racha;
    salidaMejor.textContent = puntaje.mejorRacha;
  }

  function nuevoEjercicio(moverFoco) {
    ejercicio = generarEjercicio(tipo.value);
    respondido = false;
    enunciado.textContent = ejercicio.enunciado;

    const esOpcion = ejercicio.tipo === "misma-red";
    entradaTexto.hidden = esOpcion;
    entradaOpciones.hidden = !esOpcion;
    campo.value = "";
    campo.readOnly = false;
    corregir.hidden = false;
    botonesOpcion.forEach((boton) => {
      boton.removeAttribute("aria-disabled");
    });
    campo.placeholder = ejercicio.tipo === "hosts" ? "Por ejemplo: 62" : "Por ejemplo: 192.168.1.0";

    mensaje.hidden = true;
    mensaje.textContent = "";
    campo.removeAttribute("aria-invalid");
    devolucion.hidden = true;
    otro.hidden = true;

    if (moverFoco) {
      (esOpcion ? botonesOpcion[0] : campo).focus();
    }
  }

  function responder(texto) {
    if (respondido) return;
    const correccion = corregirEjercicio(ejercicio, texto);

    // Si no se entiende la respuesta, se avisa sin descontar
    if (!correccion.valida) {
      mensaje.textContent = correccion.mensaje;
      mensaje.hidden = false;
      campo.setAttribute("aria-invalid", "true");
      return;
    }

    respondido = true;
    mensaje.hidden = true;
    campo.removeAttribute("aria-invalid");
    campo.readOnly = true;
    corregir.hidden = true;
    botonesOpcion.forEach((boton) => boton.setAttribute("aria-disabled", "true"));

    puntaje = actualizarPuntaje(puntaje, correccion.correcta);
    guardar(CLAVE_PUNTAJE, JSON.stringify(puntaje));
    dibujarPuntaje();

    if (correccion.correcta) {
      // Vuelve a disparar la animación aunque la clase ya estuviera puesta
      salidaRacha.classList.remove("racha-sube");
      void salidaRacha.offsetWidth;
      salidaRacha.classList.add("racha-sube");
    }

    devolucion.className = correccion.correcta ? "veredicto" : "veredicto veredicto-falla";
    resultado.textContent = correccion.correcta ? "¡Correcto!" : "No es esa";
    diagnostico.textContent = correccion.diagnostico;
    explicacion.textContent = correccion.explicacion;
    devolucion.hidden = false;
    otro.hidden = false;
    otro.focus();
  }

  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();
    responder(campo.value);
  });

  botonesOpcion.forEach((boton) => {
    boton.addEventListener("click", () => responder(boton.dataset.respuesta));
  });

  otro.addEventListener("click", () => nuevoEjercicio(true));

  tipo.addEventListener("change", () => nuevoEjercicio(false));

  document.getElementById("prac-reiniciar").addEventListener("click", () => {
    puntaje = puntajeInicial();
    guardar(CLAVE_PUNTAJE, JSON.stringify(puntaje));
    dibujarPuntaje();
  });

  dibujarPuntaje();
  nuevoEjercicio(false);
}
