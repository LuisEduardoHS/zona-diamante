const pantallaJuego = document.getElementById("pantallaJuego");
const resultadoOverlay = document.getElementById("resultadoOverlay");

function mostrarResultado() {
    resultadoOverlay.classList.add("activo");

    pantallaJuego.removeEventListener("click", mostrarResultado);
}

pantallaJuego.addEventListener("click", mostrarResultado);