"use strict";

/* Pantalla de la calculadora: lee la entrada, usa el motor y dibuja los resultados. */

// Crea una fila (IP o máscara) con 4 octetos de 8 bits, todavía sin valores.
// Los elementos se reutilizan al actualizar, así los bits pueden cambiar con transición.
function crearFilaBinaria() {
  const raiz = crearElemento("div", "fila-binaria");
  const titulo = crearElemento("h4");
  const lista = crearElemento("ol", "octetos");
  const octetos = [];

  for (let i = 0; i < 4; i++) {
    const item = crearElemento("li", "octeto");
    const decimal = crearElemento("span", "octeto-decimal");
    decimal.setAttribute("aria-hidden", "true");
    const contenedorBits = crearElemento("span", "bits");
    contenedorBits.setAttribute("aria-hidden", "true");
    const bits = [];
    for (let b = 0; b < 8; b++) {
      const bit = crearElemento("span", "bit");
      contenedorBits.append(bit);
      bits.push(bit);
    }
    // Versión en texto para lectores de pantalla
    const descripcion = crearElemento("span", "oculto");
    item.append(decimal, contenedorBits, descripcion);
    lista.append(item);
    octetos.push({ decimal, bits, descripcion });
  }

  raiz.append(titulo, lista);
  return { raiz, titulo, octetos };
}

function actualizarFilaBinaria(fila, nombre, octetos, prefijo) {
  fila.titulo.textContent = `${nombre}: ${octetosATexto(octetos)}`;
  octetos.forEach((octeto, indice) => {
    const binario = numeroABinario(octeto);
    const bitsDeRed = Math.min(8, Math.max(0, prefijo - indice * 8));
    const elementos = fila.octetos[indice];
    elementos.decimal.textContent = octeto;
    elementos.bits.forEach((bit, posicion) => {
      bit.textContent = binario[posicion];
      bit.className = posicion < bitsDeRed ? "bit bit-red" : "bit bit-host";
    });
    elementos.descripcion.textContent =
      `Octeto ${indice + 1}: ${octeto}, en binario ${binario}; ` +
      `${bitsDeRed} bits de red y ${8 - bitsDeRed} de host.`;
  });
}

// Arma los datos de las tarjetas, con los textos para estudiar
function armarTarjetas(s) {
  let explicacionHosts = `Hay ${s.bitsHost} bits de host: 2^${s.bitsHost} − 2. Se restan la dirección de red y la de broadcast.`;
  if (s.prefijo === 31) {
    explicacionHosts = "Un /31 tiene 2 direcciones y ambas se usan en enlaces punto a punto (RFC 3021).";
  }
  if (s.prefijo === 32) {
    explicacionHosts = "Un /32 identifica una sola dirección: un único host.";
  }

  const sinBroadcast = s.broadcast === null;
  return [
    { titulo: "Máscara", valor: `${s.mascara} (/${s.prefijo})`, explicacion: `Marca ${s.prefijo} bits de red y ${s.bitsHost} de host.` },
    { titulo: "Dirección de red", valor: s.red, explicacion: "Identifica a la subred: es la IP con todos los bits de host en 0 (IP AND máscara)." },
    {
      titulo: "Broadcast",
      valor: sinBroadcast ? "No tiene" : s.broadcast,
      explicacion: sinBroadcast
        ? `Un /${s.prefijo} no tiene dirección de broadcast.`
        : "Llega a todos los hosts de la subred: es la red con todos los bits de host en 1.",
    },
    {
      titulo: "Primer host utilizable",
      valor: s.primerHost,
      explicacion: sinBroadcast
        ? "Sin dirección de broadcast, el rango empieza en la dirección de red."
        : "La dirección siguiente a la de red.",
    },
    {
      titulo: "Último host utilizable",
      valor: s.ultimoHost,
      explicacion: sinBroadcast
        ? "Sin dirección de broadcast, el rango termina en la última dirección."
        : "La dirección anterior a la de broadcast.",
    },
    { titulo: "Hosts utilizables", valor: s.hosts.toLocaleString("es-AR"), explicacion: explicacionHosts },
    { titulo: "Tipo de IP", valor: s.tipo.tipo, explicacion: s.tipo.detalle },
    { titulo: "Clase histórica", valor: s.clase, explicacion: "Dato informativo según el primer octeto. Hoy las redes se definen con CIDR, no por clase." },
  ];
}

function iniciarCalculadora() {
  const formulario = document.getElementById("calc-formulario");
  const entrada = document.getElementById("calc-entrada");
  const error = document.getElementById("calc-error");
  const estado = document.getElementById("calc-estado");
  const resultados = document.getElementById("calc-resultados");
  const resumenBits = document.getElementById("calc-resumen-bits");
  const tarjetas = document.getElementById("calc-tarjetas");

  const filaIP = crearFilaBinaria();
  const filaMascara = crearFilaBinaria();
  document.getElementById("calc-binario").append(filaIP.raiz, filaMascara.raiz);

  function dibujar(ipOctetos, prefijo) {
    const s = calcularSubred(ipOctetos, prefijo);
    resumenBits.textContent = `Esta subred usa ${s.prefijo} bits de red y ${s.bitsHost} bits de host.`;
    actualizarFilaBinaria(filaIP, "IP", s.ipOctetos, s.prefijo);
    actualizarFilaBinaria(filaMascara, "Máscara", s.mascaraOctetos, s.prefijo);
    tarjetas.replaceChildren(
      ...armarTarjetas(s).map(({ titulo, valor, explicacion }) => {
        const tarjeta = crearElemento("div", "tarjeta");
        tarjeta.append(
          crearElemento("dt", "", titulo),
          crearElemento("dd", "valor", valor),
          crearElemento("dd", "explicacion", explicacion)
        );
        return tarjeta;
      })
    );
    return s;
  }

  function calcular() {
    try {
      const { ipOctetos, prefijo } = interpretarEntrada(entrada.value);
      const s = dibujar(ipOctetos, prefijo);
      estado.textContent = `Resultado: red ${s.red}, ${s.hosts.toLocaleString("es-AR")} hosts utilizables.`;
      error.hidden = true;
      error.textContent = "";
      entrada.removeAttribute("aria-invalid");
      resultados.hidden = false;
    } catch (problema) {
      // Un error de programación no se disfraza de error de la persona
      if (!(problema instanceof ErrorEntrada)) throw problema;
      error.textContent = problema.message;
      error.hidden = false;
      entrada.setAttribute("aria-invalid", "true");
      resultados.hidden = true;
      estado.textContent = "";
    }
  }

  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault(); // evita que el navegador recargue la página
    calcular();
  });

  document.querySelectorAll("#calculadora [data-ejemplo]").forEach((boton) => {
    boton.addEventListener("click", () => {
      entrada.value = boton.dataset.ejemplo;
      calcular();
    });
  });

  calcular(); // muestra el ejemplo inicial
}
