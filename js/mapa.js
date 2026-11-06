"use strict";

/* Pantalla del mapa de subredes: divide una red y la dibuja como un plano de bloques. */

const CASOS_MAPA = [
  {
    nombre: "Oficina",
    red: "192.168.10.0/24",
    modo: "hosts",
    valor: "100, 50, 20",
    // Se asignan según el orden de la lista de pedidos
    nombres: ["Ventas", "Invitados", "Servidores"],
  },
  { nombre: "4 subredes", red: "192.168.1.0/24", modo: "subredes", valor: "4" },
  { nombre: "5 subredes", red: "10.0.0.0/24", modo: "subredes", valor: "5" },
  { nombre: "30 hosts cada una", red: "172.16.0.0/24", modo: "hosts", valor: "30" },
];

function textoRango(bloque) {
  return bloque.primerHost === bloque.ultimoHost
    ? bloque.primerHost
    : `${bloque.primerHost} a ${bloque.ultimoHost}`;
}

function textoCantidadHosts(hosts) {
  return hosts.toLocaleString("es-AR");
}

function resumirDivision(division, modo, valor, prefijoBase) {
  const { bloques, bitsPrestados, prefijoNuevo } = division;
  if (bitsPrestados === undefined) {
    const usados = bloques.filter((bloque) => !bloque.libre).length;
    const libres = bloques.length - usados;
    const textoLibres = libres === 0 ? "No sobran direcciones." : `Lo que sobra queda libre en ${libres === 1 ? "1 bloque" : `${libres} bloques`}.`;
    return `Cada pedido recibe el bloque más chico que le alcanza: ${usados === 1 ? "1 subred" : `${usados} subredes`} a medida. ${textoLibres}`;
  }
  if (bitsPrestados === 0) {
    return `La red queda entera: 1 subred /${prefijoNuevo} de ${textoCantidadHosts(bloques[0].hosts)} hosts utilizables.`;
  }
  const prestados = `Se ${bitsPrestados === 1 ? "presta 1 bit" : `prestan ${bitsPrestados} bits`}`;
  const base = `del /${prefijoBase}: ${bloques.length} subredes /${prefijoNuevo} de ${textoCantidadHosts(bloques[0].hosts)} hosts utilizables cada una.`;
  if (modo === "subredes" && bloques.length !== valor) {
    return `${prestados} ${base} Pediste ${valor}, pero la cantidad siempre es una potencia de 2.`;
  }
  return `${prestados} ${base}`;
}

function iniciarMapa() {
  const formulario = document.getElementById("mapa-formulario");
  const campoRed = document.getElementById("mapa-red");
  const campoValor = document.getElementById("mapa-valor");
  const etiquetaValor = document.getElementById("mapa-etiqueta-valor");
  const ayudaValor = document.getElementById("mapa-ayuda-valor");
  const radios = [...document.querySelectorAll('input[name="mapa-modo"]')];
  const error = document.getElementById("mapa-error");
  const resultado = document.getElementById("mapa-resultado");
  const resumen = document.getElementById("mapa-resumen");
  const plano = document.getElementById("mapa-plano");
  const tooltip = document.getElementById("mapa-tooltip");
  const detalle = document.getElementById("mapa-detalle");
  const filas = document.getElementById("mapa-filas");

  const nombres = new Map(); // clave del bloque -> nombre puesto por la persona
  let elementos = new Map(); // clave del bloque -> { boton, nombre, fila, botonFila }
  let seleccionada = null;

  const modoActual = () => radios.find((radio) => radio.checked).value;

  function actualizarCampoValor() {
    if (modoActual() === "subredes") {
      etiquetaValor.textContent = "Cantidad de subredes";
      ayudaValor.textContent = "Se reparte toda la red en bloques iguales.";
    } else {
      etiquetaValor.textContent = "Hosts necesarios";
      ayudaValor.textContent =
        "Un número reparte toda la red en bloques iguales de ese tamaño. Una lista como 100, 50, 20 arma un bloque a medida para cada pedido.";
    }
  }

  function nombreDe(bloque) {
    if (bloque.libre) return "Libre";
    return nombres.get(bloque.clave) || "";
  }

  // --- Tooltip: solo con mouse o con foco de teclado; al tocar se usa el detalle ---
  function mostrarTooltip(bloque, x, y) {
    tooltip.replaceChildren();
    const titulo = nombreDe(bloque) ? `${nombreDe(bloque)}: ${bloque.clave}` : bloque.clave;
    tooltip.append(
      crearElemento("strong", "", titulo),
      crearElemento("span", "", `Hosts: ${textoRango(bloque)} (${textoCantidadHosts(bloque.hosts)})`)
    );
    tooltip.hidden = false;
    // Lo mantiene dentro de la ventana
    const margen = 12;
    const caja = tooltip.getBoundingClientRect();
    const izquierda = Math.min(x + margen, window.innerWidth - caja.width - margen);
    const arriba = Math.min(y + margen, window.innerHeight - caja.height - margen);
    tooltip.style.left = `${Math.max(margen, izquierda)}px`;
    tooltip.style.top = `${Math.max(margen, arriba)}px`;
  }

  function ocultarTooltip() {
    tooltip.hidden = true;
  }

  // --- Detalle del bloque elegido, con el campo para ponerle nombre ---
  function dibujarDetalle(bloque) {
    detalle.replaceChildren();
    if (bloque.libre) {
      detalle.append(crearElemento("h4", "", `Bloque libre: ${bloque.clave}`));
    } else {
      const etiqueta = crearElemento("label", "", `Nombre de ${bloque.clave}`);
      etiqueta.htmlFor = "mapa-nombre";
      const campo = crearElemento("input");
      campo.id = "mapa-nombre";
      campo.type = "text";
      campo.maxLength = 30;
      campo.placeholder = "Por ejemplo: Ventas";
      campo.autocomplete = "off";
      campo.value = nombreDe(bloque);
      campo.addEventListener("input", () => {
        const texto = campo.value.trim();
        if (texto) {
          nombres.set(bloque.clave, texto);
        } else {
          nombres.delete(bloque.clave);
        }
        actualizarNombre(bloque);
      });
      detalle.append(etiqueta, campo);
    }

    const datos = crearElemento("dl", "datos-bloque");
    const filasDatos = [
      ["Máscara", bloque.mascara],
      ["Rango de hosts", textoRango(bloque)],
      ["Broadcast", bloque.broadcast === null ? "No tiene" : bloque.broadcast],
      ["Hosts utilizables", textoCantidadHosts(bloque.hosts)],
    ];
    if (bloque.pedidos !== undefined) {
      filasDatos.push(["Hosts pedidos", textoCantidadHosts(bloque.pedidos)]);
    }
    for (const [titulo, valor] of filasDatos) {
      const par = crearElemento("div");
      par.append(crearElemento("dt", "", titulo), crearElemento("dd", "", valor));
      datos.append(par);
    }
    detalle.append(datos);
  }

  function seleccionar(bloque) {
    seleccionada = bloque.clave;
    for (const [clave, { boton, fila }] of elementos) {
      boton.setAttribute("aria-pressed", String(clave === seleccionada));
      fila.dataset.activa = String(clave === seleccionada);
    }
    dibujarDetalle(bloque);
  }

  // Refleja un nombre nuevo en el bloque, la lista y la etiqueta para lectores de pantalla
  function actualizarNombre(bloque) {
    const { nombre, botonFila, boton } = elementos.get(bloque.clave);
    const texto = nombreDe(bloque);
    nombre.textContent = texto;
    botonFila.lastChild.textContent = texto || "Sin nombre";
    boton.setAttribute("aria-label", etiquetaBloque(bloque));
  }

  function etiquetaBloque(bloque) {
    const inicio = nombreDe(bloque) ? `${nombreDe(bloque)}, ` : "";
    return `${inicio}subred ${bloque.clave}, hosts de ${textoRango(bloque)}, ${textoCantidadHosts(bloque.hosts)} utilizables`;
  }

  function dibujarBloques(bloques, prefijoBase) {
    elementos = new Map();
    plano.replaceChildren();
    filas.replaceChildren();
    ocultarTooltip();

    // El índice de color sigue el orden de direcciones; los libres no gastan color
    const colores = new Map();
    bloques.filter((bloque) => !bloque.libre).forEach((bloque, i) => colores.set(bloque.clave, i % 8));

    const demoraPorBloque = Math.min(30, 300 / bloques.length);
    calcularPlano(bloques, prefijoBase)
      .sort((p, q) => p.bloque.redNumero - q.bloque.redNumero)
      .forEach(({ bloque, x, y, ancho, alto }, orden) => {
        const claseColor = bloque.libre ? "bloque-libre" : `bloque-color-${colores.get(bloque.clave)}`;
        const boton = crearElemento("button", `bloque ${claseColor}`);
        boton.type = "button";
        boton.style.left = `${x * 100}%`;
        boton.style.top = `${y * 100}%`;
        boton.style.width = `${ancho * 100}%`;
        boton.style.height = `${alto * 100}%`;
        boton.style.animationDelay = `${orden * demoraPorBloque}ms`;
        boton.setAttribute("aria-label", etiquetaBloque(bloque));

        const contenido = crearElemento("span", "bloque-contenido");
        const nombre = crearElemento("span", "bloque-nombre", nombreDe(bloque));
        contenido.append(
          nombre,
          crearElemento("span", "bloque-cidr", bloque.clave),
          crearElemento("span", "bloque-prefijo", `/${bloque.prefijo}`)
        );
        boton.append(contenido);

        boton.addEventListener("click", () => seleccionar(bloque));
        boton.addEventListener("pointermove", (evento) => {
          if (evento.pointerType === "mouse") mostrarTooltip(bloque, evento.clientX, evento.clientY);
        });
        boton.addEventListener("pointerleave", ocultarTooltip);
        boton.addEventListener("focus", () => {
          if (!boton.matches(":focus-visible")) return;
          const caja = boton.getBoundingClientRect();
          mostrarTooltip(bloque, caja.left + caja.width / 2, caja.top + caja.height / 2);
        });
        boton.addEventListener("blur", ocultarTooltip);
        plano.append(boton);

        // Fila equivalente de la lista
        const fila = crearElemento("tr");
        const celdaNombre = crearElemento("td");
        const botonFila = crearElemento("button", "boton-fila");
        botonFila.type = "button";
        const muestra = crearElemento("span", `muestra-color ${claseColor}`);
        muestra.setAttribute("aria-hidden", "true");
        botonFila.append(muestra, crearElemento("span", "", nombreDe(bloque) || "Sin nombre"));
        botonFila.addEventListener("click", () => seleccionar(bloque));
        celdaNombre.append(botonFila);
        fila.append(
          celdaNombre,
          crearElemento("td", "", bloque.clave),
          crearElemento("td", "", textoRango(bloque)),
          crearElemento("td", "", bloque.broadcast === null ? "No tiene" : bloque.broadcast),
          crearElemento("td", "", textoCantidadHosts(bloque.hosts))
        );
        filas.append(fila);

        elementos.set(bloque.clave, { boton, nombre, fila, botonFila });
      });

    const inicial = bloques.find((bloque) => bloque.clave === seleccionada)
      || bloques.find((bloque) => !bloque.libre);
    seleccionar(inicial);
  }

  function dividir() {
    const modo = modoActual();
    const { ipOctetos, prefijo } = interpretarEntrada(campoRed.value);
    if (modo === "subredes") {
      const texto = campoValor.value.trim();
      if (!/^\d+$/.test(texto)) {
        throw new ErrorEntrada("La cantidad de subredes tiene que ser un número entero mayor que 0.");
      }
      const pedidas = Number(texto);
      return { division: dividirEnN(ipOctetos, prefijo, pedidas), modo, valor: pedidas, prefijo };
    }
    const lista = leerListaHosts(campoValor.value);
    const division = lista.length === 1
      ? dividirPorHosts(ipOctetos, prefijo, lista[0])
      : asignarVLSM(ipOctetos, prefijo, lista);
    return { division, modo, valor: lista, prefijo };
  }

  function dibujarMapa() {
    try {
      const { division, modo, valor, prefijo } = dividir();
      resumen.textContent = resumirDivision(division, modo, valor, prefijo);
      error.hidden = true;
      error.textContent = "";
      resultado.hidden = false;
      dibujarBloques(division.bloques, prefijo);
      return division;
    } catch (problema) {
      if (!(problema instanceof ErrorEntrada)) throw problema;
      error.textContent = problema.message;
      error.hidden = false;
      resultado.hidden = true;
      return null;
    }
  }

  function cargarCaso(caso) {
    campoRed.value = caso.red;
    campoValor.value = caso.valor;
    radios.forEach((radio) => {
      radio.checked = radio.value === caso.modo;
    });
    actualizarCampoValor();
    seleccionada = null;
    nombres.clear();
    const division = dibujarMapa();
    if (division && caso.nombres) {
      for (const bloque of division.bloques) {
        if (!bloque.libre && caso.nombres[bloque.indicePedido]) {
          nombres.set(bloque.clave, caso.nombres[bloque.indicePedido]);
          actualizarNombre(bloque);
        }
      }
      dibujarDetalle(division.bloques.find((bloque) => bloque.clave === seleccionada));
    }
  }

  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();
    dibujarMapa();
  });

  radios.forEach((radio) => {
    radio.addEventListener("change", () => {
      actualizarCampoValor();
      campoValor.value = "";
      campoValor.focus();
    });
  });

  const lista = document.getElementById("mapa-ejemplos");
  for (const caso of CASOS_MAPA) {
    const item = crearElemento("li");
    const boton = crearElemento("button", "", caso.nombre);
    boton.type = "button";
    boton.addEventListener("click", () => cargarCaso(caso));
    item.append(boton);
    lista.append(item);
  }

  cargarCaso(CASOS_MAPA[0]);
}
