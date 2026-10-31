export function bindBatInput(button, { signal, swing, active = () => !button.hidden }) {
    // Timing is measured on contact, not on release. The subsequent pointer
    // click must not turn into a second swing if a new pitch has already begun.
    const hit = () => { if (active() && !button.disabled && !button.hidden) swing(); };
    button.addEventListener('pointerdown',event => {
        if (event.button === 0 && event.isPrimary !== false) hit();
    },{signal});
    // Native keyboard, assistive technology and programmatic clicks have detail 0.
    button.addEventListener('click',event => { if (!(event.detail > 0)) hit(); },{signal});
    const keydown = event => {
        if (!active() || !['Space','Enter'].includes(event.code) || event.ctrlKey || event.altKey || event.metaKey) return;
        const target = event.target;
        if (target !== button && target?.closest?.('input,select,textarea,button,a,[contenteditable="true"],dialog')) return;
        if (document.querySelector('dialog[open]')) return;
        event.preventDefault();
        if (event.repeat) return;
        if (!button.disabled && !button.hidden) swing();
    };
    window.addEventListener('keydown',keydown,{signal});
}
