// Presentation only: never advances the game clock or changes a server result.
export function createGameMotion({ media = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)'),
    requestFrame = fn => requestAnimationFrame(fn), cancelFrame = id => cancelAnimationFrame(id),
    now = () => performance.now() } = {}) {
    const panels = new Map(), effects = new Map(), counters = new Map();
    let disposed = false;
    const reduced = () => disposed || media?.matches;
    function stopEffect(node) { effects.get(node)?.cancel(); effects.delete(node); }
    function effect(node, frames, { duration=340, delay=0, easing='cubic-bezier(.16,1,.3,1)' }={}) {
        stopEffect(node);
        if(reduced() || !node.animate) return;
        const animation=node.animate(frames,{duration,delay,easing}); effects.set(node,animation);
        animation.finished.then(()=>{if(effects.get(node)===animation)effects.delete(node);},()=>{});
    }
    function visible(node, show, {duration=show?280:180}={}) {
        const previous=panels.get(node);
        if(previous?.show===show)return;
        if(!previous && node.hidden===!show){panels.set(node,{show});return;}
        const opacity=node.hidden?0:Number(globalThis.getComputedStyle?.(node).opacity ?? 1);
        previous?.animation?.cancel();
        const entry={show};panels.set(node,entry);
        node.inert=!show;
        node.setAttribute('aria-hidden',String(!show));
        node.toggleAttribute('data-motion-leaving',!show);
        const settle=()=>{if(panels.get(node)!==entry)return;node.hidden=!show;node.removeAttribute('data-motion-leaving');entry.animation=null;};
        entry.settle=settle;
        if(reduced() || !node.animate){settle();return;}
        node.hidden=false;
        entry.animation=node.animate([{opacity},{opacity:show?1:0}],{duration,easing:'ease-out'});
        entry.animation.finished.then(settle,()=>{});
    }
    function pulse(node, kind='score') {
        const frames=kind==='miss'?[{transform:'translateX(0)'},{transform:'translateX(-3px)',offset:.25},{transform:'translateX(3px)',offset:.5},{transform:'translateX(0)'}]
            :[{transform:'translateY(0) scale(1)'},{transform:`translateY(-2px) scale(${kind==='countdown'?1.22:1.16})`,offset:.25},{transform:'translateY(0) scale(1)'}];
        effect(node,frames,{duration:kind==='countdown'?520:380});
    }
    function count(node, value, {from=0,prefix='',duration=760,delay=180}={}) {
        counters.get(node)?.finish();
        const final=prefix+value;
        node.textContent=final;
        if(!Number.isFinite(value) || reduced() || from===value)return;
        node.setAttribute('aria-label',final);
        const start=now()+delay;
        const entry={frame:null,finish(){if(entry.frame!==null)cancelFrame(entry.frame);node.textContent=final;node.removeAttribute('aria-label');counters.delete(node);}};
        counters.set(node,entry);
        const tick=time=>{
            const progress=Math.max(0,Math.min(1,(time-start)/duration));
            node.textContent=prefix+Math.round(from+(value-from)*(1-(1-progress)**3));
            if(progress<1)entry.frame=requestFrame(tick);else entry.finish();
        };
        node.textContent=prefix+from;entry.frame=requestFrame(tick);
    }
    function settleAll() {
        for(const entry of panels.values()){entry.animation?.cancel();entry.settle?.();}
        for(const node of effects.keys())stopEffect(node);
        for(const entry of [...counters.values()])entry.finish();
    }
    const preferenceChanged=()=>{if(media.matches)settleAll();};
    media?.addEventListener?.('change',preferenceChanged);
    return {visible,pulse,effect,count,
        reset(){settleAll();panels.clear();},
        destroy(){disposed=true;settleAll();panels.clear();media?.removeEventListener?.('change',preferenceChanged);}
    };
}
