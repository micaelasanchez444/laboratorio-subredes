"use strict";

/* Punto de arranque: navegación entre secciones e inicio de cada una. */

function iniciarNavegacion() {
  const vistas = [...document.querySelectorAll(".vista")];
  const enlaces = [...document.querySelectorAll(".navegacion a")];

  function mostrar(id, moverFoco) {
    for (const vista of vistas) {
      vista.hidden = vista.id !== id;
    }
    for (const enlace of enlaces) {
      if (enlace.hash === `#${id}`) {
        enlace.setAttribute("aria-current", "page");
      } else {
        enlace.removeAttribute("aria-current");
      }
    }
    if (moverFoco) {
      document.querySelector(`#${id} .titulo-vista`).focus({ preventScroll: true });
    }
  }

  // El enlace "Saltar al contenido" también cambia el hash: esos valores no son secciones
  const esVista = (id) => vistas.some((vista) => vista.id === id);

  window.addEventListener("hashchange", () => {
    const id = location.hash.slice(1);
    if (esVista(id)) mostrar(id, true);
  });

  const inicial = location.hash.slice(1);
  mostrar(esVista(inicial) ? inicial : vistas[0].id, false);
}

document.addEventListener("DOMContentLoaded", () => {
  iniciarTema();
  iniciarNavegacion();
  iniciarCalculadora();
});
