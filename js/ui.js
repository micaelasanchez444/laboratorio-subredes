"use strict";

/* Ayudas de pantalla que comparten todas las secciones. */

const CLAVE_TEMA = "laboratorio-subredes-tema";

// El almacenamiento puede estar bloqueado: nada de lo que se guarda es crítico
function leerGuardado(clave) {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function guardar(clave, valor) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento, el valor dura hasta recargar la página
  }
}

// Se ejecuta enseguida para que la página no parpadee con el tema equivocado
(function aplicarTemaGuardado() {
  const tema = leerGuardado(CLAVE_TEMA);
  if (tema === "light" || tema === "dark") {
    document.documentElement.dataset.theme = tema;
  }
})();

function temaActual() {
  const elegido = document.documentElement.dataset.theme;
  if (elegido) return elegido;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function iniciarTema() {
  const boton = document.getElementById("boton-tema");
  const actualizarTexto = () => {
    boton.textContent = temaActual() === "dark" ? "Usar modo claro" : "Usar modo oscuro";
  };
  actualizarTexto();
  boton.addEventListener("click", () => {
    const nuevo = temaActual() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nuevo;
    guardar(CLAVE_TEMA, nuevo);
    actualizarTexto();
  });
  // Si la persona no eligió tema, el texto sigue al del sistema
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", actualizarTexto);
}

// True si la persona pidió "reducir movimiento" en su sistema
function movimientoReducido() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Crea un elemento con clase y texto opcionales
function crearElemento(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  // textContent nunca interpreta HTML: lo que escriba la persona no se ejecuta
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}
