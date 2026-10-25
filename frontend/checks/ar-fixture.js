// LOCAL TEST ONLY. Replaces MindAR, never shipped by ar-vista.html.
window.addEventListener('error',e=>window.parent.postMessage({tipo:'fixture-error',mensaje:e.error?.stack||e.message},location.origin));
Object.defineProperty(navigator.mediaDevices,'enumerateDevices',{configurable:true,value:async()=>[{kind:'videoinput',deviceId:'fixture'}]});
AFRAME.registerSystem('mindar-image-system',{
    init(){this.controller={processVideo(){}};},
    async start(){
        const fondo=document.createElement('canvas'); fondo.width=960; fondo.height=1280;
        const ctx=fondo.getContext('2d');
        const pintar=()=>{
            const grad=ctx.createLinearGradient(0,0,960,900); grad.addColorStop(0,'#1c697f'); grad.addColorStop(1,'#9fc7c9');
            ctx.fillStyle=grad; ctx.fillRect(0,0,960,800); ctx.fillStyle='#37724f'; ctx.fillRect(0,800,960,480);
            ctx.fillStyle='#be9970'; ctx.beginPath();ctx.moveTo(480,780);ctx.lineTo(850,1030);ctx.lineTo(480,1260);ctx.lineTo(110,1030);ctx.closePath();ctx.fill();
            ctx.strokeStyle='#ffffff90';ctx.lineWidth=4;ctx.stroke();
            this.frame=requestAnimationFrame(pintar);
        }; pintar();
        this.video=document.createElement('video'); this.video.muted=true;this.video.autoplay=true;this.video.playsInline=true;this.video.style.zIndex='-2';
        document.body.append(this.video); this.video.srcObject=fondo.captureStream(15); await this.video.play();
        const camera=document.getElementById('ar-camera').getObject3D('camera'); camera.near=10;camera.far=100000;camera.fov=45;camera.updateProjectionMatrix();
        document.querySelectorAll('[id^="target-"]').forEach(t=>{t.object3D.visible=false;}); this.el.emit('arReady');
    },
    pause(){this.video?.pause();},
    stop(){cancelAnimationFrame(this.frame);this.video?.srcObject?.getTracks().forEach(t=>t.stop());sessionStorage.setItem('ar-fixture-stopped','true');}
});
