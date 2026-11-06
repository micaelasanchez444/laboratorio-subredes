"use strict";

/* Pantalla de ¿Llega el paquete?: simulación paso a paso con la compuerta AND. */

const MS_POR_BIT = 260;
const MS_POR_TRAMO = 650;

const CASOS_PAQUETE = [
  { nombre: "Otra red con gateway", a: "192.168.1.10/24", b: "192.168.2.20/24", gateway: "192.168.1.1" },
  { nombre: "Misma red", a: "192.168.1.10/24", b: "192.168.1.20/24", gateway: "192.168.1.1" },
  { nombre: "Sin gateway", a: "192.168.1.10/24", b: "192.168.2.20/24", gateway: "" },
  { nombre: "Gateway fuera de la red", a: "192.168.1.10/24", b: "192.168.2.20/24", gateway: "10.0.0.1" },
  { nombre: "Máscaras distintas", a: "192.168.1.10/16", b: "192.168.2.20/24", gateway: "192.168.1.1" },
];

// Compuerta dibujada a mano: el contenido es fijo, nunca viene de lo que escribe la persona
const SVG_COMPUERTA = `
  <svg viewBox="0 0 200 92" role="img" aria-label="Compuerta lógica AND">
    <path class="compuerta-linea" data-linea="a" d="M26 28H68"/>
    <path class="compuerta-linea" data-linea="b" d="M26 64H68"/>
    <path class="compuerta-linea" data-linea="salida" d="M132 46H174"/>
    <path class="compuerta-cuerpo" d="M68 10H100A36 36 0 0 1 100 82H68Z"/>
    <text class="compuerta-texto" x="98" y="51">AND</text>
    <text class="compuerta-texto" data-valor="a" x="14" y="33"></text>
    <text class="compuerta-texto" data-valor="b" x="14" y="69"></text>
    <text class="compuerta-texto" data-valor="salida" x="187" y="51"></text>
  </svg>`;

function crearTablaVerdad() {
  const tabla = crearElemento("table", "tabla-verdad");
  const leyenda = crearElemento("caption", "", "Tabla de verdad: da 1 solo si ambos bits son 1");
  const encabezado = crearElemento("tr");
  for (const titulo of ["IP", "Máscara", "AND"]) {
    const celda = crearElemento("th", "", titulo);
    celda.scope = "col";
    encabezado.append(celda);
  }
  const cabeza = crearElemento("thead");
  cabeza.append(encabezado);
  const cuerpo = crearElemento("tbody");
  for (const [x, y] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
    const fila = crearElemento("tr");
    fila.dataset.fila = `${x}${y}`;
    fila.append(crearElemento("td", "", x), crearElemento("td", "", y), crearElemento("td", "", x & y));
    cuerpo.append(fila);
  }
  tabla.append(leyenda, cabeza, cuerpo);
  return tabla;
}

function crearCompuerta() {
  const caja = crearElemento("div", "compuerta");
  const dibujo = crearElemento("div");
  dibujo.innerHTML = SVG_COMPUERTA;
  const operacion = crearElemento("p", "compuerta-operacion");
  caja.append(dibujo, operacion, crearTablaVerdad());

  // Muestra en la compuerta y en la tabla la cuenta de un bit
  function mostrar(x, y) {
    const salida = x & y;
    const valores = { a: x, b: y, salida };
    for (const [nombre, valor] of Object.entries(valores)) {
      caja.querySelector(`[data-valor="${nombre}"]`).textContent = valor;
      caja.querySelector(`[data-linea="${nombre}"]`).classList.toggle("compuerta-linea-activa", valor === 1);
    }
    operacion.textContent = `${x} AND ${y} = ${salida}`;
    caja.querySelectorAll("[data-fila]").forEach((fila) => {
      fila.classList.toggle("fila-activa", fila.dataset.fila === `${x}${y}`);
    });
  }

  return { caja, mostrar };
}

// Red parcial: "192.168.__.__" mientras se calcula octeto por octeto
function textoRedParcial(redOctetos, calculados) {
  return redOctetos.map((octeto, i) => (i < calculados ? octeto : "__")).join(".");
}

function crearEquipo(nombre, valor) {
  const caja = crearElemento("div", "equipo");
  caja.append(crearElemento("p", "equipo-nombre", nombre), crearElemento("p", "valor", valor));
  return caja;
}

function crearDatosAnalisis(a, b, gatewayOctetos) {
  return {
    a,
    b,
    gatewayOctetos,
    analisis: analizarPaquete(a, b, gatewayOctetos),
  };
}

function armarPasos() {
  const pasos = [{ tipo: "planteo" }];
  for (const equipo of ["A", "B"]) {
    for (let indice = 0; indice < 4; indice++) {
      pasos.push({ tipo: "and", equipo, indice });
    }
  }
  pasos.push({ tipo: "comparar" }, { tipo: "conclusion" });
  return pasos;
}

function textoEquipo(equipo) {
  return `${octetosATexto(equipo.ipOctetos)}/${equipo.prefijo}`;
}

// Elige los nodos del dibujo y hasta dónde llega el paquete
function armarRecorrido(analisis) {
  const pcA = { nombre: "PC A", ip: analisis.ipA, icono: "PC" };
  const pcB = { nombre: "PC B", ip: analisis.ipB, icono: "PC" };
  const conmutador = { nombre: "Switch", ip: "", icono: "SW" };

  if (analisis.resultado === "directo") {
    return { nodos: [pcA, conmutador, pcB], destino: 2 };
  }
  if (analisis.resultado === "gateway") {
    const router = { nombre: "Router", ip: analisis.gateway, icono: "R" };
    return { nodos: [pcA, conmutador, router, pcB], destino: 3 };
  }
  // En los casos que fallan, el paquete nunca sale de PC A
  const textoGateway = analisis.gateway ? analisis.gateway : "sin configurar";
  const router = { nombre: "Gateway", ip: textoGateway, icono: "?", apagado: true };
  if (analisis.resultado === "misma-ip") {
    return { nodos: [pcA, { ...pcB, apagado: true }], destino: null };
  }
  return { nodos: [pcA, router, { ...pcB, apagado: true }], destino: null };
}

function dibujarRecorrido(analisis, contenedor) {
  const { nodos, destino } = armarRecorrido(analisis);
  const recorrido = crearElemento("div", "recorrido");
  const centro = (i) => ((i + 0.5) / nodos.length) * 100;

  const cable = crearElemento("span", "recorrido-cable");
  cable.style.left = `${centro(0)}%`;
  cable.style.right = `${100 - centro(nodos.length - 1)}%`;
  recorrido.append(cable);

  const elementos = nodos.map((nodo) => {
    const elemento = crearElemento("div", nodo.apagado ? "nodo nodo-apagado" : "nodo");
    const icono = crearElemento("span", "nodo-icono", nodo.icono);
    icono.setAttribute("aria-hidden", "true");
    elemento.append(icono, crearElemento("span", "nodo-nombre", nodo.nombre));
    if (nodo.ip) elemento.append(crearElemento("span", "nodo-ip", nodo.ip));
    recorrido.append(elemento);
    return elemento;
  });

  const punto = crearElemento("span", "paquete-punto");
  punto.setAttribute("aria-hidden", "true");
  recorrido.append(punto);
  contenedor.append(recorrido);

  const llego = destino !== null;
  const inicio = centro(0);
  // Si falla, el paquete apenas se asoma por el cable y se frena antes del siguiente nodo
  const fin = llego ? centro(destino) : (centro(0) + centro(1)) / 2;
  const tramos = llego ? destino : 0.5;

  function terminar() {
    punto.style.left = `${fin}%`;
    if (llego) {
      elementos[destino].classList.add("nodo-llegada");
    } else {
      punto.classList.add("paquete-punto-frenado");
      punto.textContent = "✕";
    }
  }

  if (movimientoReducido()) {
    terminar();
    return Promise.resolve();
  }

  punto.style.left = `${inicio}%`;
  const animacion = punto.animate(
    [{ left: `${inicio}%` }, { left: `${fin}%` }],
    { duration: MS_POR_TRAMO * tramos, easing: "ease-in-out" }
  );
  return animacion.finished.then(terminar, () => {});
}

function iniciarPaquete() {
  const formulario = document.getElementById("paq-formulario");
  const campos = {
    a: document.getElementById("paq-a"),
    b: document.getElementById("paq-b"),
    gateway: document.getElementById("paq-gateway"),
  };
  const error = document.getElementById("paq-error");
  const simulacion = document.getElementById("paq-simulacion");
  const contador = document.getElementById("paq-contador");
  const barra = document.getElementById("paq-barra");
  const tituloPaso = document.getElementById("paq-titulo-paso");
  const descripcion = document.getElementById("paq-descripcion");
  const escena = document.getElementById("paq-escena");
  const anterior = document.getElementById("paq-anterior");
  const siguiente = document.getElementById("paq-siguiente");

  let datos = null;
  let pasos = [];
  let pasoActual = 0;
  let temporizador = null; // el barrido en curso; se cancela al cambiar de paso

  function cancelarBarrido() {
    clearTimeout(temporizador);
    temporizador = null;
  }

  // --- Paso 1: planteo ---
  function dibujarPlanteo() {
    tituloPaso.textContent = "PC A quiere mandarle un paquete a PC B";
    descripcion.textContent =
      "Primero, cada equipo saca su dirección de red con una compuerta lógica AND entre su IP y su máscara: " +
      "los bits de máscara en 1 dejan pasar el bit de la IP, y los que están en 0 lo apagan.";

    const equipos = crearElemento("div", "equipos");
    equipos.append(
      crearEquipo("PC A", textoEquipo(datos.a)),
      crearEquipo("PC B", textoEquipo(datos.b)),
      crearEquipo("Gateway de PC A", datos.gatewayOctetos ? octetosATexto(datos.gatewayOctetos) : "Sin configurar")
    );
    escena.append(equipos, crearTablaVerdad());
  }

  // --- Pasos del AND: un octeto por paso, bit por bit ---
  function dibujarAND(paso) {
    const equipo = paso.equipo === "A" ? datos.a : datos.b;
    const mascara = numeroAOctetos(prefijoAMascara(equipo.prefijo));
    const redOctetos = calcularRed(equipo.ipOctetos, equipo.prefijo);
    const octetoIP = equipo.ipOctetos[paso.indice];
    const octetoMascara = mascara[paso.indice];
    const octetoRed = redOctetos[paso.indice];
    const bitsIP = numeroABinario(octetoIP);
    const bitsMascara = numeroABinario(octetoMascara);
    const bitsRed = numeroABinario(octetoRed);

    tituloPaso.textContent = `PC ${paso.equipo}: AND del octeto ${paso.indice + 1} de 4`;
    descripcion.textContent =
      `${octetoIP} AND ${octetoMascara} = ${octetoRed}. En binario: ${bitsIP} AND ${bitsMascara} = ${bitsRed}.`;

    const operacion = crearElemento("div", "operacion");
    const izquierda = crearElemento("div");
    const tabla = crearElemento("div", "tabla-and");
    tabla.setAttribute("aria-hidden", "true");

    function agregarFila(etiqueta, valor, bits, oculta) {
      const rotulo = crearElemento("div", "tabla-and-etiqueta", etiqueta);
      rotulo.append(crearElemento("strong", "", valor));
      tabla.append(rotulo);
      return [...bits].map((bit) => {
        const clase = oculta ? "celda-bit" : `celda-bit${bit === "1" ? " celda-uno" : ""}`;
        const celda = crearElemento("div", clase, oculta ? "·" : bit);
        tabla.append(celda);
        return celda;
      });
    }

    const celdasIP = agregarFila("IP", octetoIP, bitsIP, false);
    const celdasMascara = agregarFila("Máscara", octetoMascara, bitsMascara, false);
    tabla.append(crearElemento("div", "separador-and"));
    const celdasRed = agregarFila("Red", octetoRed, bitsRed, true);

    const parcial = crearElemento("p", "red-parcial");
    parcial.append(`Red de PC ${paso.equipo} hasta acá:`);
    const valorParcial = crearElemento(
      "span",
      "valor",
      `${textoRedParcial(redOctetos, paso.indice)}`
    );
    parcial.append(valorParcial);
    izquierda.append(tabla, parcial);

    const compuerta = crearCompuerta();
    operacion.append(izquierda, compuerta.caja);
    escena.append(operacion);

    function revelar(i) {
      const celda = celdasRed[i];
      celda.textContent = bitsRed[i];
      celda.classList.toggle("celda-uno", bitsRed[i] === "1");
      celda.classList.add("celda-revelada");
    }

    function terminar() {
      [...celdasIP, ...celdasMascara, ...celdasRed].forEach((celda) => celda.classList.remove("celda-activa"));
      valorParcial.textContent = textoRedParcial(redOctetos, paso.indice + 1);
    }

    if (movimientoReducido()) {
      bitsRed.split("").forEach((_, i) => revelar(i));
      compuerta.mostrar(Number(bitsIP[7]), Number(bitsMascara[7]));
      terminar();
      return;
    }

    // Recorre los bits de a uno: resalta la columna y hace la cuenta en la compuerta
    function barrer(i) {
      if (i === 8) {
        terminar();
        return;
      }
      [...celdasIP, ...celdasMascara, ...celdasRed].forEach((celda) => celda.classList.remove("celda-activa"));
      celdasIP[i].classList.add("celda-activa");
      celdasMascara[i].classList.add("celda-activa");
      celdasRed[i].classList.add("celda-activa");
      compuerta.mostrar(Number(bitsIP[i]), Number(bitsMascara[i]));
      revelar(i);
      temporizador = setTimeout(() => barrer(i + 1), MS_POR_BIT);
    }
    barrer(0);
  }

  // --- Comparación de redes ---
  function dibujarComparacion() {
    const { analisis } = datos;
    const iguales = analisis.directoSegunA;
    tituloPaso.textContent = "PC A compara las dos redes";
    descripcion.textContent = iguales
      ? `Con la máscara /${analisis.prefijoA} de PC A, las dos direcciones dan la misma red: ${analisis.redA}.`
      : `Con la máscara /${analisis.prefijoA} de PC A, las redes son distintas: ${analisis.redA} y ${analisis.redBSegunA}.`;

    const comparacion = crearElemento("div", "comparacion");
    const simbolo = crearElemento("div", "simbolo-comparacion", iguales ? "=" : "≠");
    simbolo.setAttribute("aria-hidden", "true");
    comparacion.append(
      crearEquipo("Red de PC A", `${analisis.redA}/${analisis.prefijoA}`),
      simbolo,
      crearEquipo(`PC B, con la máscara de PC A`, `${analisis.redBSegunA}/${analisis.prefijoA}`)
    );
    escena.append(comparacion);

    if (datos.a.prefijo !== datos.b.prefijo) {
      escena.append(
        crearElemento(
          "p",
          "nota-mascaras",
          `Las máscaras son distintas. Con la suya, la red de PC B es ${analisis.redB}/${datos.b.prefijo}, pero quien decide es PC A, y usa su propia máscara.`
        )
      );
    }
  }

  // --- Conclusión ---
  function dibujarConclusion() {
    const { analisis } = datos;
    tituloPaso.textContent = "¿Qué hace el paquete?";
    // El veredicto lo muestra en pantalla: este texto queda solo para lectores de pantalla
    descripcion.textContent = `${analisis.titulo}. ${analisis.explicacion}`;
    descripcion.classList.add("oculto");

    const veredicto = crearElemento("div", analisis.llega ? "veredicto" : "veredicto veredicto-falla");
    veredicto.hidden = true;
    veredicto.append(crearElemento("h4", "", analisis.titulo), crearElemento("p", "", analisis.explicacion));
    if (analisis.advertencias.length > 0) {
      const lista = crearElemento("ul", "advertencias");
      analisis.advertencias.forEach((texto) => lista.append(crearElemento("li", "", texto)));
      veredicto.append(lista);
    }

    const pasoDibujado = pasoActual;
    dibujarRecorrido(analisis, escena).then(() => {
      // Si la persona ya cambió de paso, el veredicto ya no está en la escena
      if (pasoActual === pasoDibujado) veredicto.hidden = false;
    });
    escena.append(veredicto);
  }

  function irAlPaso(indice) {
    cancelarBarrido();
    pasoActual = indice;
    const paso = pasos[indice];
    contador.textContent = `Paso ${indice + 1} de ${pasos.length}`;
    barra.style.width = `${((indice + 1) / pasos.length) * 100}%`;
    anterior.setAttribute("aria-disabled", String(indice === 0));
    siguiente.setAttribute("aria-disabled", String(indice === pasos.length - 1));

    escena.replaceChildren();
    descripcion.classList.remove("oculto");
    if (paso.tipo === "planteo") dibujarPlanteo();
    if (paso.tipo === "and") dibujarAND(paso);
    if (paso.tipo === "comparar") dibujarComparacion();
    if (paso.tipo === "conclusion") dibujarConclusion();
  }

  // Lee un campo; si tiene un error, le agrega el nombre del equipo y marca el campo
  function leerCampo(campo, nombre, lectura) {
    try {
      return lectura(campo.value);
    } catch (problema) {
      if (!(problema instanceof ErrorEntrada)) throw problema;
      campo.setAttribute("aria-invalid", "true");
      problema.message = `${nombre}: ${problema.message}`;
      throw problema;
    }
  }

  function simular() {
    cancelarBarrido();
    Object.values(campos).forEach((campo) => campo.removeAttribute("aria-invalid"));
    try {
      const a = leerCampo(campos.a, "PC A", interpretarEntrada);
      const b = leerCampo(campos.b, "PC B", interpretarEntrada);
      const gateway = leerCampo(campos.gateway, "Gateway", (texto) =>
        texto.trim() === "" ? null : textoAOctetos(texto.trim(), "La IP del gateway")
      );
      datos = crearDatosAnalisis(a, b, gateway);
      pasos = armarPasos();
      error.hidden = true;
      error.textContent = "";
      simulacion.hidden = false;
      irAlPaso(0);
    } catch (problema) {
      if (!(problema instanceof ErrorEntrada)) throw problema;
      error.textContent = problema.message;
      error.hidden = false;
      simulacion.hidden = true;
    }
  }

  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();
    simular();
  });

  // aria-disabled, en lugar de disabled, para que el botón no pierda el foco en el último paso
  anterior.addEventListener("click", () => {
    if (pasoActual > 0) irAlPaso(pasoActual - 1);
  });
  siguiente.addEventListener("click", () => {
    if (pasoActual < pasos.length - 1) irAlPaso(pasoActual + 1);
  });

  const listaCasos = document.getElementById("paq-ejemplos");
  for (const caso of CASOS_PAQUETE) {
    const item = crearElemento("li");
    const boton = crearElemento("button", "", caso.nombre);
    boton.type = "button";
    boton.addEventListener("click", () => {
      campos.a.value = caso.a;
      campos.b.value = caso.b;
      campos.gateway.value = caso.gateway;
      simular();
    });
    item.append(boton);
    listaCasos.append(item);
  }

  const inicial = CASOS_PAQUETE[0];
  campos.a.value = inicial.a;
  campos.b.value = inicial.b;
  campos.gateway.value = inicial.gateway;
  simular();
}
