async function iniciarCamara() {
    const videoElement = document.getElementById('camara-feed');

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment'
            }
        });

        videoElement.srcObject = stream;
    } catch (error) {
        console.error("Error al acceder a la cámara: ", error);
        alert("No se pudo acceder a la cámara. Por favor, asegúrate de que tu dispositivo tenga una cámara y que hayas otorgado los permisos necesarios.");
    }
}

iniciarCamara();