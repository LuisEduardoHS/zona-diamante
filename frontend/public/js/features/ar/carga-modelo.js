// A-Frame's glTF component does not cancel previous loads on src changes.
// Own the application of the result so only the latest team can be displayed.
export function crearCargaModelo({ cargar, aplicar, error, liberar=()=>{} }) {
    const pendientes=new Map();
    let version=0, destruido=false;
    return {
        cancelar() { ++version; },
        async solicitar(index,ruta) {
            if(destruido)return;
            const solicitud=++version;
            if(!pendientes.has(ruta))pendientes.set(ruta,Promise.resolve().then(()=>cargar(ruta)));
            const pendiente=pendientes.get(ruta);
            try {
                const modelo=await pendiente;
                if(destruido)return;
                if(solicitud===version)aplicar(modelo,index,ruta);
            } catch(causa) {
                if(pendientes.get(ruta)===pendiente)pendientes.delete(ruta);
                if(!destruido&&solicitud===version)error(causa,ruta);
            }
        },
        destruir() {
            destruido=true; ++version;
            for(const pendiente of pendientes.values())pendiente.then(liberar,()=>{});
            pendientes.clear();
        }
    };
}
