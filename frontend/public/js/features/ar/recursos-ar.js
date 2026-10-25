// MindAR's stop() assumes a controller AND a video stream already exist.
// Navigation must also clean up a denied/pending/partially initialized camera.
export function detenerRecursosAR(escena) {
    const sistema=escena.systems?.['mindar-image-system'], video=sistema?.video;
    let detenido=false;
    try {
        if(sistema?.controller && video?.srcObject) { sistema.stop(); detenido=true; }
    } catch { /* Continue releasing independent resources after a partial stop. */ }
    if(!detenido) { try { sistema?.controller?.dispose?.(); } catch { /* Best effort on unload. */ } }
    for(const track of video?.srcObject?.getTracks() || [])track.stop();
    video?.remove();
    if(sistema)sistema.video=null; // Late getUserMedia must reject this old element.
    escena.renderer?.dispose();
}
